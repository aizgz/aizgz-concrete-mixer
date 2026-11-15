import { timingSafeEqual } from 'node:crypto';

const DEFAULT_CMS_ORIGIN = 'https://aizgz.vercel.app';
const STATE_COOKIE = 'aizgz_oauth_state';

function getCmsOrigin() {
  const configured = process.env.CMS_ORIGIN || DEFAULT_CMS_ORIGIN;
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.origin !== configured.replace(/\/$/, '')) {
    throw new Error('CMS_ORIGIN must be an HTTPS origin without a trailing path.');
  }
  return url.origin;
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const entry = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(name + '='));
  return entry ? entry.slice(name.length + 1) : '';
}

function clearStateCookie(res) {
  res.setHeader('Set-Cookie', STATE_COOKIE + '=; Path=/api/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

function sendError(res, status, message) {
  clearStateCookie(res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(status).send(message);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
  const expectedState = readCookie(req, STATE_COOKIE);
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  let cmsOrigin;
  try {
    cmsOrigin = getCmsOrigin();
  } catch (error) {
    console.error('OAuth origin configuration error:', error);
    return sendError(res, 500, 'OAuth is not configured correctly.');
  }

  const stateMatches = expectedState.length === returnedState.length
    && expectedState.length > 0
    && timingSafeEqual(Buffer.from(expectedState), Buffer.from(returnedState));
  if (!stateMatches) return sendError(res, 400, 'Invalid or expired OAuth state. Please close this window and try again.');
  if (!code) return sendError(res, 400, 'GitHub did not return an authorization code.');
  if (!clientId || !clientSecret) return sendError(res, 500, 'OAuth credentials are not configured.');

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: code })
    });
    const data = await response.json();
    if (!response.ok || data.error || typeof data.access_token !== 'string' || !data.access_token) {
      console.error('GitHub OAuth token exchange failed:', data.error || response.status);
      return sendError(res, 502, 'GitHub authorization could not be completed. Please try again.');
    }

    clearStateCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const message = 'authorization:github:success:' + JSON.stringify({ token: data.access_token, provider: 'github' });
    const safeMessage = JSON.stringify(message).replace(/</g, '\\u003c');
    const safeOrigin = JSON.stringify(cmsOrigin);
    const html = [
      '<!doctype html>',
      '<html lang="en"><head><meta charset="utf-8"><title>GitHub Authorization</title></head><body>',
      '<script>',
      '(function () {',
      '  const allowedOrigin = ' + safeOrigin + ';',
      '  const successMessage = ' + safeMessage + ';',
      '  const opener = window.opener;',
      "  if (!opener) { document.body.textContent = 'Authorization complete. You may close this window.'; return; }",
      '  const receiveMessage = function (event) {',
      '    if (event.source !== opener || event.origin !== allowedOrigin) return;',
      '    opener.postMessage(successMessage, allowedOrigin);',
      "    window.removeEventListener('message', receiveMessage, false);",
      '    window.close();',
      '  };',
      "  window.addEventListener('message', receiveMessage, false);",
      "  opener.postMessage('authorizing:github', allowedOrigin);",
      '})();',
      '</script><p>Completing GitHub authorization…</p></body></html>'
    ].join('\n');
    return res.status(200).send(html);
  } catch (error) {
    console.error('OAuth callback failed:', error);
    return sendError(res, 500, 'GitHub authorization failed. Please try again.');
  }
}
