/* Wavelore Audio pricing: billing switch with animated prices, live prices from the API,
   a checkout session per plan that hands off to the payment page, and the chrome specular
   that follows the pointer. */
(() => {
  'use strict';

  const section = document.querySelector('[data-section="pricing"]');
  if (!section) return;

  const lang = document.documentElement.lang || 'en';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const copySource = document.getElementById('copy');
  const statusEl = document.getElementById('status');
  const saveBadge = section.querySelector('[data-save]');

  let currency = section.dataset.currency || 'USD';
  let interval = (section.querySelector('input[name="interval"]:checked') || {}).value || 'monthly';
  let checkoutBusy = false;

  /* Every string the script shows lives in <template id="copy">, keyed by data-copy,
     so a translation only touches the HTML. {placeholders} are filled from vars. */
  function copy(key, vars = {}) {
    const node = copySource && copySource.content.querySelector(`[data-copy="${key}"]`);
    const text = node ? node.textContent : key;
    return text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : ''));
  }

  function money(cents) {
    return new Intl.NumberFormat(lang, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
  }

  function clockTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  // kind: undefined = screen readers only, 'notice' = shown, 'error' = shown in the error colour.
  function announce(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('is-visible', Boolean(kind));
    statusEl.classList.toggle('is-error', kind === 'error');
  }

  /* ---------------------------------------------------------------- prices */

  const plans = new Map();
  for (const tile of section.querySelectorAll('[data-plan]')) {
    const monthly = Number(tile.dataset.monthly) || 0;
    plans.set(tile.dataset.plan, {
      tile,
      prices: { monthly, yearly: Number(tile.dataset.yearly) || monthly * 12 },
      shownCents: monthly,
      amountEl: tile.querySelector('[data-amount]'),
      noteEl: tile.querySelector('[data-note]'),
    });
  }

  // Yearly plans are shown as their per-month equivalent; the note carries the real yearly charge.
  const perMonthCents = (prices) => (interval === 'yearly' ? Math.round(prices.yearly / 12) : prices.monthly);

  const tweens = new WeakMap();

  // Eases the displayed amount from one value to the next; each frame is derived from the elapsed time.
  function tweenAmount(el, from, to) {
    if (reduceMotion.matches || from === to) {
      el.textContent = money(to);
      return;
    }
    const duration = 650;
    let start = 0;
    const frame = (now) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = money(from + (to - from) * eased);
      if (progress < 1) tweens.set(el, requestAnimationFrame(frame));
    };
    cancelAnimationFrame(tweens.get(el) || 0);
    tweens.set(el, requestAnimationFrame(frame));
    el.classList.remove('is-pulsing');
    void el.offsetWidth; // restart the pulse animation
    el.classList.add('is-pulsing');
  }

  function renderPrices() {
    for (const plan of plans.values()) {
      const target = perMonthCents(plan.prices);
      if (plan.amountEl) tweenAmount(plan.amountEl, plan.shownCents, target);
      plan.shownCents = target;
      if (plan.noteEl) {
        plan.noteEl.textContent =
          interval === 'yearly' ? copy('billed-yearly', { amount: money(plan.prices.yearly) }) : copy('billed-monthly');
      }
    }
    section.dataset.interval = interval;
  }

  function setBilling(next) {
    if (next === interval) return;
    interval = next;
    renderPrices();
    announce(copy(interval === 'yearly' ? 'announce-yearly' : 'announce-monthly'));
  }

  for (const radio of section.querySelectorAll('input[name="interval"]')) {
    radio.addEventListener('change', () => {
      if (radio.checked) setBilling(radio.value);
    });
  }

  async function loadPlans() {
    try {
      const res = await fetch('/api/plans', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (typeof data.currency === 'string') currency = data.currency;
      for (const remote of Array.isArray(data.plans) ? data.plans : []) {
        const plan = plans.get(remote.id);
        if (!plan || !remote.prices) continue;
        plan.prices = {
          monthly: Number(remote.prices.monthly) || plan.prices.monthly,
          yearly: Number(remote.prices.yearly) || plan.prices.yearly,
        };
      }
      if (saveBadge && Number.isFinite(data.yearlySavingsPercent)) {
        saveBadge.textContent = copy('save', { percent: new Intl.NumberFormat(lang).format(data.yearlySavingsPercent) });
      }
      renderPrices();
    } catch {
      announce(copy('plans-offline'), 'notice');
    }
  }

  /* ---------------------------------------------------------------- checkout */

  function setButtonState(button, state) {
    const label = button.querySelector('.cta-label');
    if (label && !button.dataset.label) button.dataset.label = label.textContent;
    button.dataset.state = state;
    button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    button.disabled = state === 'loading';
    if (label) label.textContent = state === 'loading' ? copy('loading') : button.dataset.label;
  }

  function lockButtons(locked) {
    for (const button of section.querySelectorAll('[data-checkout]')) {
      if (!button.hidden) button.disabled = locked;
    }
  }

  // Only same-origin paths or absolute http(s) URLs are accepted as the hand-off target.
  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    return /^https?:\/\//i.test(value) ? value : '';
  }

  /* Success: the feature list gives way to the confirmation, and the button is replaced by a link
     to the payment page, so the next step is one obvious click. */
  function showReceipt(tile, body) {
    const receipt = tile.querySelector('[data-receipt]');
    const button = tile.querySelector('[data-checkout]');
    const next = tile.querySelector('[data-continue]');
    if (!receipt || !button || !next) return;
    const amount = money(Number(body.amountCents) || 0);
    const amountKey = body.interval === 'yearly' ? 'amount-yearly' : 'amount-monthly';
    receipt.querySelector('[data-receipt-message]').textContent = body.message || '';
    receipt.querySelector('[data-receipt-amount]').textContent = copy(amountKey, { amount });
    const time = body.expiresAt ? clockTime(body.expiresAt) : '';
    receipt.querySelector('[data-receipt-expires]').textContent = time ? copy('expires', { time }) : '';
    const url = safeUrl(body.checkoutUrl);
    if (url) next.href = url;
    receipt.hidden = false;
    tile.classList.add('is-done');
    button.hidden = true;
    next.hidden = false;
    next.focus({ preventScroll: true });
  }

  async function requestSession(planId) {
    const res = await fetch('/api/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ planId, interval }),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok && Boolean(body && body.ok), body };
  }

  async function startCheckout(tile) {
    if (checkoutBusy) return;
    checkoutBusy = true;
    const button = tile.querySelector('[data-checkout]');
    announce('');
    setButtonState(button, 'loading');
    lockButtons(true);

    let result;
    try {
      result = await requestSession(tile.dataset.plan);
    } catch {
      result = { ok: false, body: null, offline: true };
    }

    if (result.ok) {
      setButtonState(button, 'idle');
      showReceipt(tile, result.body);
    } else {
      setButtonState(button, 'idle');
      const message = result.body && result.body.message;
      announce(result.offline ? copy('error-network') : message || copy('error-generic'), 'error');
    }
    lockButtons(false);
    checkoutBusy = false;
  }

  section.addEventListener('click', (event) => {
    const button = event.target.closest('[data-checkout]');
    const tile = button && button.closest('[data-plan]');
    if (tile && !button.disabled) startCheckout(tile);
  });

  /* ---------------------------------------------------------------- pointer specular + housekeeping */

  // The specular is lit from pointer events (not :hover) so it also tracks pens and emulated pointers.
  let litTile = null;

  function light(tile) {
    if (litTile && litTile !== tile) litTile.classList.remove('is-lit');
    litTile = tile;
    if (tile) tile.classList.add('is-lit');
  }

  section.addEventListener('pointermove', (event) => {
    const tile = event.target.closest('.tile');
    light(tile);
    if (!tile) return;
    const rect = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    tile.style.setProperty('--my', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  });

  section.addEventListener('pointerleave', () => light(null));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && statusEl && statusEl.classList.contains('is-error')) announce('');
  });

  document.addEventListener('visibilitychange', () => {
    const bg = document.getElementById('bg');
    if (bg) bg.classList.toggle('is-paused', document.hidden);
  });

  loadPlans();
})();
