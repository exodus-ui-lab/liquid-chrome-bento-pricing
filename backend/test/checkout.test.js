import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createApp } from '../src/app.js';
import { BILLING_INTERVALS, PLANS } from '../src/plans.js';

const quietApp = (options = {}) => createApp({ log: () => {}, ...options });

function postCheckout(app, body, headers = {}) {
  return app.request('/api/checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/checkout-session', () => {
  test('rejects an unknown plan and interval with one detail per field', async () => {
    const res = await postCheckout(quietApp(), { planId: 'enterprise', interval: 'weekly' });

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      ok: false,
      error: 'validation',
      message: 'Choose a plan and a billing interval to continue.',
      details: [
        { field: 'planId', message: 'planId must be one of solo, network, studio' },
        { field: 'interval', message: 'interval must be monthly or yearly' },
      ],
    });
  });

  test('lists only the failing field and compares case-sensitively', async () => {
    const res = await postCheckout(quietApp(), { planId: 'Network', interval: 'yearly' });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.deepEqual(body.details.map((d) => d.field), ['planId']);
  });

  test('reports malformed and non-object JSON against the body field', async () => {
    for (const raw of ['{"planId": "solo",', '["solo", "monthly"]', 'null']) {
      const res = await postCheckout(quietApp(), raw);
      const body = await res.json();

      assert.equal(res.status, 400, raw);
      assert.deepEqual(body.details, [{ field: 'body', message: 'body must be a JSON object' }]);
    }
  });

  test('trims input and answers with catalogue values, never the raw strings', async () => {
    const app = quietApp({ now: () => Date.parse('2026-10-02T10:00:00.000Z') });
    const res = await postCheckout(app, { planId: '  solo\u0000 ', interval: '\tmonthly\n', note: '<script>' });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.planId, 'solo');
    assert.equal(body.interval, 'monthly');
    assert.equal(body.amountCents, 1900);
    assert.equal(body.expiresAt, '2026-10-02T10:30:00.000Z');
    assert.ok(!JSON.stringify(body).includes('<script>'));
  });

  test('charges the same catalogue price that GET /api/plans advertises', async () => {
    const app = quietApp({ checkoutLimit: PLANS.length * BILLING_INTERVALS.length });
    for (const plan of PLANS) {
      for (const interval of BILLING_INTERVALS) {
        const body = await (await postCheckout(app, { planId: plan.id, interval })).json();
        assert.equal(body.amountCents, plan.prices[interval], `${plan.id}/${interval}`);
      }
    }
  });

  test('requires a JSON content type', async () => {
    const res = await postCheckout(quietApp(), 'planId=solo', { 'Content-Type': 'text/plain' });

    assert.equal(res.status, 415);
    assert.equal((await res.json()).error, 'unsupported_media_type');
  });

  test('rejects bodies larger than 2 KB before parsing them', async () => {
    const res = await postCheckout(quietApp(), { planId: 'solo', interval: 'monthly', padding: 'x'.repeat(2048) });

    assert.equal(res.status, 413);
    assert.equal((await res.json()).error, 'payload_too_large');
  });

  test('rate limits each client IP and tells it when to retry', async () => {
    const app = quietApp({ checkoutLimit: 2 });
    const valid = { planId: 'network', interval: 'yearly' };
    const fromA = { 'X-Forwarded-For': '203.0.113.7, 10.0.0.1' };

    assert.equal((await postCheckout(app, valid, fromA)).status, 201);
    assert.equal((await postCheckout(app, valid, fromA)).status, 201);
    const limited = await postCheckout(app, valid, fromA);

    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    assert.deepEqual(await limited.json(), {
      ok: false,
      error: 'rate_limited',
      message: 'Too many checkout attempts. Please wait a minute and try again.',
      retryAfterSeconds: 60,
    });
    assert.equal((await postCheckout(app, valid, { 'X-Forwarded-For': '198.51.100.4' })).status, 201);
  });

  test('marks every response as uncacheable and unsniffable', async () => {
    for (const res of [
      await postCheckout(quietApp(), { planId: 'solo', interval: 'monthly' }),
      await postCheckout(quietApp(), {}),
    ]) {
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    }
  });
});

describe('routing and CORS', () => {
  test('unknown API paths return the JSON not_found body', async () => {
    const res = await quietApp().request('/api/coupons');

    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await res.json(), { ok: false, error: 'not_found', message: 'No such endpoint.' });
  });

  test('sends no CORS headers unless an origin is configured', async () => {
    const res = await quietApp().request('/api/plans', { headers: { Origin: 'https://elsewhere.example' } });

    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('answers preflight requests for the configured origin', async () => {
    const app = quietApp({ allowedOrigin: 'https://shop.wavelore.example' });
    const res = await app.request('/api/checkout-session', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://shop.wavelore.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://shop.wavelore.example');
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
  });
});
