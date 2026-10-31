import { Hono } from 'hono';

import { CURRENCY, PLANS, YEARLY_SAVINGS_PERCENT } from '../plans.js';
import { sendJson } from '../responses.js';

const CATALOGUE = { currency: CURRENCY, yearlySavingsPercent: YEARLY_SAVINGS_PERCENT, plans: PLANS };

export function planRoutes() {
  return new Hono().get('/plans', (c) =>
    sendJson(c, 200, CATALOGUE, { 'Cache-Control': 'public, max-age=300' }),
  );
}
