export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const branch = String(process.env.VERCEL_GIT_COMMIT_REF || 'main');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).json({
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    branch: /^[A-Za-z0-9._/-]+$/.test(branch) ? branch : 'main'
  });
}
