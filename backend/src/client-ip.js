// Behind a proxy that sets X-Forwarded-For, its first hop is the original client. Exposed directly,
// the header is client-controlled, so such deployments should run with trustProxy disabled.
export function clientIp(c, { trustProxy }) {
  if (trustProxy) {
    const firstHop = c.req.header('x-forwarded-for')?.split(',')[0].trim();
    if (firstHop) return firstHop;
  }
  return c.env?.incoming?.socket?.remoteAddress ?? 'unknown';
}
