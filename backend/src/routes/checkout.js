import { Hono } from 'hono';
import { z } from 'zod';

import { jsonBody } from '../middleware/json-body.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { noStore } from '../middleware/security-headers.js';
import { BILLING_INTERVALS, PLAN_IDS, findPlan } from '../plans.js';
import { sendJson } from '../responses.js';

const MAX_BODY_BYTES = 2 * 1024;
const INVALID_MESSAGE = 'Choose a plan and a billing interval to continue.';
const READY_MESSAGE = 'Nothing is charged until your 14 free days end.';
const RATE_LIMITED_MESSAGE = 'Too many checkout attempts. Please wait a minute and try again.';
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

// Strip control characters and whitespace, then match the catalogue exactly (case-sensitive).
const choice = (values, message) =>
  z
    .string({ error: message })
    .transform((value) => value.replace(CONTROL_CHARS, '').trim())
    .pipe(z.enum(values, { error: message }));

const checkoutSchema = z.object({
  planId: choice(PLAN_IDS, `planId must be one of ${PLAN_IDS.join(', ')}`),
  interval: choice(BILLING_INTERVALS, `interval must be ${BILLING_INTERVALS.join(' or ')}`),
});

export function checkoutRoutes({ sessions, limit, windowMs, keyOf, now, log }) {
  const retryAfterSeconds = Math.ceil(windowMs / 1000);
  const limiter = rateLimit({
    limit,
    windowMs,
    keyOf,
    now,
    onLimited: (c) =>
      sendJson(
        c,
        429,
        { ok: false, error: 'rate_limited', message: RATE_LIMITED_MESSAGE, retryAfterSeconds },
        { 'Retry-After': String(retryAfterSeconds) },
      ),
  });

  return new Hono().post(
    '/checkout-session',
    noStore(),
    limiter,
    jsonBody({ schema: checkoutSchema, maxBytes: MAX_BODY_BYTES, invalidMessage: INVALID_MESSAGE }),
    (c) => {
      const { planId, interval } = c.get('body');

      // The response is built from the stored session, never from the client's strings.
      const session = sessions.create(findPlan(planId), interval);
      log(`checkout session ${session.id}: ${session.planId}/${session.interval} ${session.amountCents} ${session.currency}`);

      return sendJson(c, 201, {
        ok: true,
        sessionId: session.id,
        planId: session.planId,
        interval: session.interval,
        amountCents: session.amountCents,
        currency: session.currency,
        expiresAt: new Date(session.expiresAt).toISOString(),
        // Same-origin relative path: the page only follows links that start with a single "/".
        checkoutUrl: `/checkout/${session.id}`,
        message: READY_MESSAGE,
      });
    },
  );
}
