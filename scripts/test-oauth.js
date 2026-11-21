import assert from 'node:assert/strict';
import authHandler from '../api/auth.js';
import callbackHandler from '../api/callback.js';

const STATE_COOKIE = 'aizgz_oauth_state';
const originalEnv = {
  CMS_ORIGIN: process.env.CMS_ORIGIN,
  OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET
};
const originalFetch = globalThis.fetch;

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectLocation: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    send(value) { this.body = value; return this; },
    redirect(code, location) {
      this.statusCode = code;
      this.redirectLocation = location;
      return this;
    }
  };
}

async function invoke(handler, { method = 'GET', query = {}, cookie = '' } = {}) {
  const req = { method, query, headers: cookie ? { cookie } : {} };
  const res = response();
  await handler(req, res);
  return res;
}

function cookieValue(header) {
  const match = /^aizgz_oauth_state=([a-f0-9]{64});/.exec(header || '');
  assert.ok(match, 'OAuth state cookie should contain a 64-character hex state');
  return match[1];
}

function assertClearedCookie(res) {
  assert.match(res.headers['set-cookie'] || '', /^aizgz_oauth_state=; Path=\/api\/callback; Max-Age=0;/);
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
}

try {
  process.env.CMS_ORIGIN = 'https://aizgz.vercel.app';
  process.env.OAUTH_CLIENT_ID = 'test-client-id';
  process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';

  const wrongAuthMethod = await invoke(authHandler, { method: 'POST' });
  assert.equal(wrongAuthMethod.statusCode, 405);
  assert.equal(wrongAuthMethod.headers.allow, 'GET');

  const authOne = await invoke(authHandler);
  assert.equal(authOne.statusCode, 302);
  const authorizeUrl = new URL(authOne.redirectLocation);
  assert.equal(authorizeUrl.origin + authorizeUrl.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(authorizeUrl.searchParams.get('client_id'), 'test-client-id');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'public_repo read:user');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://aizgz.vercel.app/api/callback');
  const stateOne = cookieValue(authOne.headers['set-cookie']);
  assert.equal(authorizeUrl.searchParams.get('state'), stateOne);
  assert.match(authOne.headers['set-cookie'], /HttpOnly/);
  assert.match(authOne.headers['set-cookie'], /Secure/);
  assert.match(authOne.headers['set-cookie'], /SameSite=Lax/);
  assert.match(authOne.headers['set-cookie'], /Max-Age=600/);
  assert.equal(authOne.headers['cache-control'], 'no-store');

  const authTwo = await invoke(authHandler);
  const stateTwo = cookieValue(authTwo.headers['set-cookie']);
  assert.notEqual(stateOne, stateTwo, 'each authorization attempt should use a fresh state');

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('Unexpected network call in a rejected OAuth flow');
  };

  const missingState = await invoke(callbackHandler, {
    query: { code: 'test-code', state: stateOne },
    cookie: ''
  });
  assert.equal(missingState.statusCode, 400);
  assert.match(missingState.body, /Invalid or expired OAuth state/);
  assertClearedCookie(missingState);
  assert.equal(fetchCalls, 0);

  const mismatchedState = await invoke(callbackHandler, {
    query: { code: 'test-code', state: '0'.repeat(64) },
    cookie: STATE_COOKIE + '=' + stateOne
  });
  assert.equal(mismatchedState.statusCode, 400);
  assertClearedCookie(mismatchedState);
  assert.equal(fetchCalls, 0);

  const missingCode = await invoke(callbackHandler, {
    query: { state: stateOne },
    cookie: STATE_COOKIE + '=' + stateOne
  });
  assert.equal(missingCode.statusCode, 400);
  assert.match(missingCode.body, /authorization code/);
  assertClearedCookie(missingCode);
  assert.equal(fetchCalls, 0);

  delete process.env.OAUTH_CLIENT_SECRET;
  const missingSecret = await invoke(callbackHandler, {
    query: { code: 'test-code', state: stateOne },
    cookie: STATE_COOKIE + '=' + stateOne
  });
  assert.equal(missingSecret.statusCode, 500);
  assert.match(missingSecret.body, /credentials are not configured/);
  assertClearedCookie(missingSecret);
  assert.equal(fetchCalls, 0);
  process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';

  process.env.CMS_ORIGIN = 'http://aizgz.vercel.app';
  const invalidOrigin = await invoke(authHandler);
  assert.equal(invalidOrigin.statusCode, 500);
  assert.equal(invalidOrigin.redirectLocation, undefined);
  process.env.CMS_ORIGIN = 'https://aizgz.vercel.app';

  let exchangeRequest;
  globalThis.fetch = async (url, options) => {
    fetchCalls += 1;
    exchangeRequest = { url, options };
    return {
      ok: true,
      status: 200,
      async json() { return { access_token: 'mock-access-token' }; }
    };
  };

  const success = await invoke(callbackHandler, {
    query: { code: 'mock-auth-code', state: stateOne },
    cookie: STATE_COOKIE + '=' + stateOne
  });
  assert.equal(success.statusCode, 200);
  assert.equal(fetchCalls, 1);
  assert.equal(exchangeRequest.url, 'https://github.com/login/oauth/access_token');
  assert.equal(exchangeRequest.options.method, 'POST');
  assert.equal(exchangeRequest.options.headers.Accept, 'application/json');
  assert.equal(exchangeRequest.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(exchangeRequest.options.body), {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    code: 'mock-auth-code'
  });
  assertClearedCookie(success);
  assert.equal(success.headers['cache-control'], 'no-store');
  assert.equal(success.headers['x-content-type-options'], 'nosniff');
  assert.equal(success.headers['referrer-policy'], 'no-referrer');
  assert.match(success.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(success.headers['content-type'], /text\/html/);
  assert.match(success.body, /https:\/\/aizgz\.vercel\.app/);
  assert.match(success.body, /event\.source !== opener/);
  assert.match(success.body, /event\.origin !== allowedOrigin/);
  assert.match(success.body, /mock-access-token/);

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return { error: 'bad_verification_code', error_description: 'private detail' }; }
  });
  const exchangeError = await invoke(callbackHandler, {
    query: { code: 'bad-code', state: stateOne },
    cookie: STATE_COOKIE + '=' + stateOne
  });
  assert.equal(exchangeError.statusCode, 502);
  assert.match(exchangeError.body, /could not be completed/);
  assert.doesNotMatch(exchangeError.body, /private detail/);
  assertClearedCookie(exchangeError);

  globalThis.fetch = async () => { throw new Error('mock network failure'); };
  const networkError = await invoke(callbackHandler, {
    query: { code: 'network-code', state: stateOne },
    cookie: STATE_COOKIE + '=' + stateOne
  });
  assert.equal(networkError.statusCode, 500);
  assert.match(networkError.body, /authorization failed/);
  assertClearedCookie(networkError);

  const wrongCallbackMethod = await invoke(callbackHandler, { method: 'POST' });
  assert.equal(wrongCallbackMethod.statusCode, 405);
  assert.equal(wrongCallbackMethod.headers.allow, 'GET');

  console.log('OAuth regression checks passed: authorization redirect/state/cookie, invalid callbacks, missing configuration, token exchange, safe messaging headers, GitHub errors, network failures, and method restrictions. All GitHub requests were mocked; no real OAuth authorization was performed.');
} finally {
  restoreEnvironment();
}
