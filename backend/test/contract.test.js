import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createApp } from '../src/app.js';

const demo = JSON.parse(await readFile(new URL('../../demo.json', import.meta.url), 'utf8'));

// The requests the pricing page sends (frontend/app.js) for the demo: yearly billing, Network plan.
const demoRequests = {
  'GET /api/plans': { headers: { Accept: 'application/json' } },
  'POST /api/checkout-session': {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ planId: 'network', interval: 'yearly' }),
  },
};

// Replaces every leaf with its JSON type, keeping keys and array positions.
function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value === null) return 'null';
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

for (const [route, mock] of Object.entries(demo.mockResponses)) {
  test(`${route} answers with the status and body shape the demo expects`, async () => {
    const [method, path] = route.split(' ');
    assert.ok(demoRequests[route], `no demo request defined for ${route}`);

    const app = createApp({ log: () => {} });
    const res = await app.request(path, { method, ...demoRequests[route] });
    const body = await res.json();

    assert.equal(res.status, mock.status);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(shape(body), shape(mock.body));
  });
}

test('GET /api/plans returns the catalogue exactly', async () => {
  const res = await createApp().request('/api/plans');

  assert.deepEqual(await res.json(), demo.mockResponses['GET /api/plans'].body);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
});

test('POST /api/checkout-session returns a fresh session for the demo request', async () => {
  const res = await createApp({ log: () => {} }).request('/api/checkout-session', {
    method: 'POST',
    ...demoRequests['POST /api/checkout-session'],
  });
  const body = await res.json();
  const expected = demo.mockResponses['POST /api/checkout-session'].body;

  assert.match(body.sessionId, /^cs_wl_[a-z0-9]{8}$/);
  assert.ok(Date.parse(body.expiresAt) > Date.now(), 'expiresAt lies in the future');
  assert.equal(body.checkoutUrl, `/checkout/${body.sessionId}`);
  assert.deepEqual(
    { ...body, sessionId: expected.sessionId, expiresAt: expected.expiresAt, checkoutUrl: expected.checkoutUrl },
    expected,
  );
});
