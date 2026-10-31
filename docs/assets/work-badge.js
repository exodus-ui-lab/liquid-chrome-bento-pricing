/*
 * Corner badge for the live demo: language switch and a link to the source code.
 * Rendered in a shadow root so it never inherits or changes the page's own styles.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;
  var data = script.dataset;

  var CSS =
    ':host{all:initial}' +
    'nav{display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;' +
    'background:rgba(12,12,15,.74);border:1px solid rgba(255,255,255,.14);' +
    '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 4px 18px rgba(0,0,0,.28);' +
    'font:500 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.02em;color:#f4f1ea;' +
    'opacity:.8;transition:opacity .2s ease}' +
    'nav:hover,nav:focus-within{opacity:1}' +
    'a{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border-radius:999px;' +
    'color:inherit;text-decoration:none;white-space:nowrap}' +
    'a:hover{background:rgba(255,255,255,.1)}' +
    'a[aria-current="page"]{background:rgba(255,255,255,.16)}' +
    'a:focus-visible{outline:2px solid #d4af37;outline-offset:1px}' +
    '.sep{width:1px;height:16px;margin:0 2px;background:rgba(255,255,255,.18)}' +
    'svg{width:14px;height:14px;flex:none}' +
    '@media (max-width:360px){.label{display:none}}' +
    '@media (prefers-reduced-motion:reduce){nav{transition:none}}' +
    '@media print{nav{display:none}}';

  var GITHUB_MARK =
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z';

  function link(href, text, current, lang) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    if (lang) a.hreflang = lang;
    if (current) a.setAttribute('aria-current', 'page');
    return a;
  }

  function mount() {
    var host = document.createElement('div');
    host.setAttribute('data-work-badge', '');
    host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;';
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS;
    var nav = document.createElement('nav');
    nav.setAttribute('aria-label', data.navLabel || 'Language and source code');

    var locale = data.locale === 'tr' ? 'tr' : 'en';
    if (data.enHref) nav.appendChild(link(data.enHref, 'EN', locale === 'en', 'en'));
    if (data.trHref) nav.appendChild(link(data.trHref, 'TR', locale === 'tr', 'tr'));
    if (data.codeHref) {
      var sep = document.createElement('span');
      sep.className = 'sep';
      sep.setAttribute('aria-hidden', 'true');
      nav.appendChild(sep);
      var code = link(data.codeHref, '', false, '');
      code.rel = 'noopener';
      var svgNs = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS(svgNs, 'path');
      path.setAttribute('d', GITHUB_MARK);
      path.setAttribute('fill', 'currentColor');
      svg.appendChild(path);
      var label = document.createElement('span');
      label.className = 'label';
      label.textContent = data.codeLabel || 'Code on GitHub';
      code.setAttribute('aria-label', data.codeLabel || 'Code on GitHub');
      code.appendChild(svg);
      code.appendChild(label);
      nav.appendChild(code);
    }
    root.appendChild(style);
    root.appendChild(nav);
    document.body.appendChild(host);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
