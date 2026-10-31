import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { createCheckoutSessions } from './checkout-sessions.js';
import { clientIp } from './client-ip.js';
import { securityHeaders } from './middleware/security-headers.js';
import { sendError } from './responses.js';
import { checkoutRoutes } from './routes/checkout.js';
import { planRoutes } from './routes/plans.js';

/**
 * @param {object} [options]
 * @param {string} [options.allowedOrigin] Cross-origin caller to allow; same-origin only when unset.
 * @param {number} [options.checkoutLimit] Checkout attempts allowed per client per window.
 * @param {number} [options.checkoutWindowMs] Rate-limit window length.
 * @param {boolean} [options.trustProxy] Identify clients by the first X-Forwarded-For hop.
 * @param {string} [options.staticRoot] Directory served at `/`, relative to the working directory.
 * @param {() => number} [options.now] Clock in epoch milliseconds.
 * @param {(line: string) => void} [options.log] Receives a one-line summary per checkout session.
 */
export function createApp({
  allowedOrigin,
  checkoutLimit = 10,
  checkoutWindowMs = 60_000,
  trustProxy = true,
  staticRoot,
  now = Date.now,
  log = console.info,
} = {}) {
  const app = new Hono();

  app.use(securityHeaders());
  if (allowedOrigin) {
    app.use('/api/*', cors({ origin: allowedOrigin, allowMethods: ['GET', 'POST'], allowHeaders: ['Content-Type'] }));
  }

  app.route('/api', planRoutes());
  app.route(
    '/api',
    checkoutRoutes({
      sessions: createCheckoutSessions({ now }),
      limit: checkoutLimit,
      windowMs: checkoutWindowMs,
      keyOf: (c) => clientIp(c, { trustProxy }),
      now,
      log,
    }),
  );

  if (staticRoot) app.use('/*', serveStatic({ root: staticRoot }));

  app.notFound((c) => sendError(c, 404, 'not_found', 'No such endpoint.'));
  app.onError((err, c) => {
    console.error(err);
    return sendError(c, 500, 'internal', 'Something went wrong. Please try again.');
  });

  return app;
}
