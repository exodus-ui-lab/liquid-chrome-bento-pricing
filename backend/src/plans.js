// The single plan catalogue: GET /api/plans and checkout pricing both read from here.

export const CURRENCY = 'USD';
export const BILLING_INTERVALS = Object.freeze(['monthly', 'yearly']);

// Prices are integer cents per billing interval.
const plan = (id, recommended, monthly, yearly) =>
  Object.freeze({ id, recommended, prices: Object.freeze({ monthly, yearly }) });

export const PLANS = Object.freeze([
  plan('solo', false, 1900, 18000),
  plan('network', true, 4900, 46800),
  plan('studio', false, 12900, 123600),
]);

export const PLAN_IDS = Object.freeze(PLANS.map((p) => p.id));

export function findPlan(id) {
  return PLANS.find((p) => p.id === id);
}

// Derived from the recommended plan so the "save" badge can never disagree with the prices.
const recommended = PLANS.find((p) => p.recommended);
export const YEARLY_SAVINGS_PERCENT = Math.floor(
  (1 - recommended.prices.yearly / (recommended.prices.monthly * 12)) * 100,
);
