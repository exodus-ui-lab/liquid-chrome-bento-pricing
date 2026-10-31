import { randomInt } from 'node:crypto';

import { CURRENCY } from './plans.js';

const SESSION_TTL_MS = 30 * 60 * 1000;
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;

// randomInt draws uniformly, avoiding the modulo bias of mapping random bytes onto 36 symbols.
function randomSessionId() {
  let suffix = '';
  for (let i = 0; i < ID_LENGTH; i += 1) suffix += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return `cs_wl_${suffix}`;
}

// Stand-in for a payment provider's checkout sessions: held in memory, nothing is ever charged.
export function createCheckoutSessions({ now = Date.now } = {}) {
  const sessions = new Map();

  // Every session shares one TTL and Maps iterate in insertion order, so expired entries sit at the front.
  function pruneExpired(time) {
    for (const [id, session] of sessions) {
      if (session.expiresAt > time) break;
      sessions.delete(id);
    }
  }

  return {
    create(plan, interval) {
      const createdAt = now();
      pruneExpired(createdAt);

      let id;
      do id = randomSessionId();
      while (sessions.has(id));

      const session = {
        id,
        planId: plan.id,
        interval,
        amountCents: plan.prices[interval],
        currency: CURRENCY,
        expiresAt: createdAt + SESSION_TTL_MS,
      };
      sessions.set(id, session);
      return session;
    },
  };
}
