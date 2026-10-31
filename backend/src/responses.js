const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

export function sendJson(c, status, body, headers = {}) {
  return c.body(JSON.stringify(body), status, { 'Content-Type': JSON_CONTENT_TYPE, ...headers });
}

export function sendError(c, status, error, message, extra = {}) {
  return sendJson(c, status, { ok: false, error, message, ...extra });
}
