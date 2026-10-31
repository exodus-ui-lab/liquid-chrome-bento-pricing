import { Buffer } from 'node:buffer';

import { sendError } from '../responses.js';

// Enforces media type (415), size (413), JSON object syntax and the zod schema (400), in that order,
// then exposes the parsed, schema-cleaned payload as c.get('body').
export function jsonBody({ schema, maxBytes, invalidMessage }) {
  return async function jsonBodyMiddleware(c, next) {
    const mediaType = c.req.header('content-type')?.split(';')[0].trim().toLowerCase();
    if (mediaType !== 'application/json') {
      return sendError(c, 415, 'unsupported_media_type', 'Send the request body as application/json.');
    }

    const text = await readTextWithin(c.req.raw, maxBytes);
    if (text === undefined) {
      return sendError(c, 413, 'payload_too_large', `The request body must be at most ${maxBytes} bytes.`);
    }

    const payload = parseJsonObject(text);
    if (!payload) {
      return sendError(c, 400, 'validation', invalidMessage, {
        details: [{ field: 'body', message: 'body must be a JSON object' }],
      });
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      return sendError(c, 400, 'validation', invalidMessage, { details: toDetails(result.error.issues) });
    }

    c.set('body', result.data);
    await next();
  };
}

// Checks the declared Content-Length first, then counts streamed bytes, so an oversized or chunked
// body is cut off without being buffered in full or parsed.
async function readTextWithin(request, maxBytes) {
  if (Number(request.headers.get('content-length')) > maxBytes) return undefined;
  if (!request.body) return '';

  const chunks = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > maxBytes) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// One entry per failing field, keeping the first issue zod reports for it.
function toDetails(issues) {
  const details = new Map();
  for (const issue of issues) {
    const field = issue.path.join('.') || 'body';
    if (!details.has(field)) details.set(field, { field, message: issue.message });
  }
  return [...details.values()];
}
