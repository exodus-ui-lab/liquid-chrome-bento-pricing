/*
 * Static demo helper: answers the page's fetch('/api/...') calls with the example responses from mock-data.js,
 * so the live demo works on a static host. Run the API in backend/ to get real responses instead.
 */
(function () {
  'use strict';

  var realFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  var NO_BODY = { 204: true, 205: true, 304: true };
  var MAX_DELAY_MS = 10000;

  function apiPath(url) {
    if (url.origin !== window.location.origin) return null;
    var path = url.pathname;
    var at = path === '/api' || path.indexOf('/api/') === 0 ? 0 : path.indexOf('/api/');
    if (at < 0) return null;
    return path.slice(at).replace(/\/+$/, '') || '/api';
  }

  function findResponse(key) {
    var all = window.MOCK_API_RESPONSES || {};
    if (Object.prototype.hasOwnProperty.call(all, key)) return all[key];
    for (var k in all) {
      if (Object.prototype.hasOwnProperty.call(all, k) && k.replace(/\/+$/, '') === key) return all[k];
    }
    return null;
  }

  function abortError() {
    try {
      return new DOMException('The operation was aborted.', 'AbortError');
    } catch (e) {
      var err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      return err;
    }
  }

  window.fetch = function (input, init) {
    var request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    var url;
    try {
      url = new URL(request ? request.url : String(input), document.baseURI);
    } catch (e) {
      return realFetch ? realFetch(input, init) : Promise.reject(e);
    }
    var path = apiPath(url);
    if (path === null) {
      return realFetch ? realFetch(input, init) : Promise.reject(new TypeError('fetch is not available'));
    }

    var method = String((init && init.method) || (request && request.method) || 'GET').toUpperCase();
    var key = method + ' ' + path;
    var found = findResponse(key);
    if (!found && window.console) window.console.warn('[demo] no example response for ' + key);

    var status = found ? Number(found.status) : 404;
    if (!(status >= 200 && status <= 599)) status = 500;
    var body = found ? (found.body === undefined ? null : found.body) : { error: 'No example response for "' + key + '".' };
    var delay = found ? Math.max(0, Math.min(Number(found.delayMs) || 0, MAX_DELAY_MS)) : 0;
    var signal = (init && init.signal) || (request && request.signal) || null;

    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) {
        reject(abortError());
        return;
      }
      function onAbort() {
        clearTimeout(timer);
        reject(abortError());
      }
      var timer = setTimeout(function () {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(
          new Response(NO_BODY[status] ? null : JSON.stringify(body), {
            status: status,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }),
        );
      }, delay);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  };
})();
