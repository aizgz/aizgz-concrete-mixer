export default function handler(req, res) {
  // Return only the edge-provided country code; never expose the visitor's IP.
  const raw = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '';
  const country = String(raw).trim().toUpperCase().slice(0, 2);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({ country: /^[A-Z]{2}$/.test(country) ? country : '' });
}
