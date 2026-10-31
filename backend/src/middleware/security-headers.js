// Headers are applied after the handler so they also cover 404s, errors and static files.
export function securityHeaders() {
  return async function applySecurityHeaders(c, next) {
    await next();
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'no-referrer');
  };
}

export function noStore() {
  return async function applyNoStore(c, next) {
    await next();
    c.res.headers.set('Cache-Control', 'no-store');
  };
}
