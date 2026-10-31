import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';

import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const frontendDir = fileURLToPath(new URL('../../frontend', import.meta.url));

const app = createApp({
  allowedOrigin: process.env.ALLOWED_ORIGIN?.trim() || undefined,
  trustProxy: process.env.TRUST_PROXY !== 'false',
  // serveStatic resolves its root against the working directory.
  staticRoot: relative(process.cwd(), frontendDir),
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.info(`Wavelore pricing API listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
