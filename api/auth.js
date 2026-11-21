import { randomBytes } from 'node:crypto';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }
  const clientId = process.env.OAUTH_CLIENT_ID;
  if (!clientId) return res.status(500).send('OAuth is not configured.');
  try {
    const cmsOrigin = getCmsOrigin();
    const state = randomBytes(32).toString('hex');
    const redirectUri = new URL('/api/callback', cmsOrigin).toString();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', STATE_COOKIE + '=' + state + '; Path=/api/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax');
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('scope', 'public_repo read:user');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    return res.redirect(302, authorizeUrl.toString());
  } catch (error) {
    console.error('OAuth initialization failed:', error);
    return res.status(500).send('Could not start GitHub authorization.');
  }
}
