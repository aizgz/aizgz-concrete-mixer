import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ALLOWED_COLLECTIONS = new Set(['products', 'cases', 'videos']);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const collection = typeof req.query.collection === 'string' ? req.query.collection : '';
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (collection === 'settings') {
    try {
      const raw = await readFile(path.join(process.cwd(), 'content', 'settings', 'general.json'), 'utf8');
      return res.status(200).json({ settings: JSON.parse(raw) });
    } catch (error) {
      console.error('Could not read site settings:', error);
      return res.status(500).json({ error: 'Site settings are unavailable' });
    }
  }

  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return res.status(400).json({ error: 'Unsupported content collection' });
  }

  try {
    const directory = path.join(process.cwd(), 'content', collection);
    let names = [];
    try {
      names = await readdir(directory);
    } catch (error) {
      if (error.code === 'ENOENT') return res.status(200).json({ files: [] });
      throw error;
    }

    const markdownFiles = names.filter((name) => name.toLowerCase().endsWith('.md')).sort();
    const files = await Promise.all(markdownFiles.map(async (name) => ({
      name,
      content: await readFile(path.join(directory, name), 'utf8')
    })));

    return res.status(200).json({ files });
  } catch (error) {
    console.error('Could not read content collection:', error);
    return res.status(500).json({ error: 'Content collection is unavailable' });
  }
}
