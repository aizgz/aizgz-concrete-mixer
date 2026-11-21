import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_URL = 'https://aizgz.vercel.app';
const LANGUAGES = ['en', 'es', 'ar', 'ru'];
const PRODUCT_ROOTS = [
  ['en', path.join(ROOT, 'products')],
  ...LANGUAGES.filter((language) => language !== 'en')
    .map((language) => [language, path.join(ROOT, language, 'products')])
];

function matchAll(text, pattern) {
  return [...text.matchAll(pattern)];
}

function extractAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp('\\b' + escaped + '="([^"]*)"'))?.[1] || '';
}

async function collectProductPages() {
  const pages = [];
  for (const [language, directory] of PRODUCT_ROOTS) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(directory, entry.name, 'index.html');
      try {
        await readFile(file, 'utf8');
        pages.push({ language, slug: entry.name, file });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  return pages;
}

const homepage = await readFile(path.join(ROOT, 'index.html'), 'utf8');
assert.match(homepage, /<title>[^<]+<\\/title>/i, 'Homepage must have a title');
assert.match(homepage, /<meta\\s+name="description"\\s+content="[^"]+">/i, 'Homepage must have a meta description');
assert.match(homepage, new RegExp('<link\\\\s+rel="canonical"\\\\s+href="' + SITE_URL.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '/">', 'i'), 'Homepage canonical must point to the production URL');

const pages = await collectProductPages();
assert.ok(pages.length > 0, 'Build must generate product detail pages');

const expectedUrls = new Set([SITE_URL + '/']);
const productGroups = new Map();
for (const page of pages) {
  const html = await readFile(page.file, 'utf8');
  const title = html.match(/<title>([^<]+)<\\/title>/i)?.[1] || '';
  const description = html.match(/<meta\\s+name="description"\\s+content="([^"]+)"/i)?.[1] || '';
  const canonical = html.match(/<link\\s+rel="canonical"\\s+href="([^"]+)"/i)?.[1] || '';
  assert.ok(title.trim(), `${page.file}: title is required`);
  assert.ok(description.trim(), `${page.file}: meta description is required`);
  assert.equal(canonical, `${SITE_URL}${page.language === 'en' ? '' : `/${page.language}`}/products/${page.slug}/`, `${page.file}: canonical must match its language route`);
  assert.match(html, /<script\\s+type="application\\/ld\\+json">[\\s\\S]*?"@type":"Product"[\\s\\S]*?<\\/script>/i, `${page.file}: Product structured data is required`);

  const alternates = matchAll(html, /<link\\s+rel="alternate"\\s+hreflang="([^"]+)"\\s+href="([^"]+)"\\s*>/gi)
    .map((match) => ({ language: match[1], url: match[2] }));
  assert.ok(alternates.some((item) => item.language === 'x-default' && item.url === `${SITE_URL}/products/${page.slug}/`), `${page.file}: x-default alternate is required`);
  assert.ok(alternates.some((item) => item.language === page.language && item.url === canonical), `${page.file}: self hreflang is required`);
  assert.equal(new Set(alternates.map((item) => item.language)).size, alternates.length, `${page.file}: hreflang values must be unique`);

  expectedUrls.add(canonical);
  const group = productGroups.get(page.slug) || [];
  group.push({ page, canonical, alternates });
  productGroups.set(page.slug, group);
}

const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
assert.match(sitemap, /<urlset[^>]+xmlns:xhtml="http:\\/\\/www\\.w3\\.org\\/1999\\/xhtml"/, 'Sitemap must declare the XHTML namespace');
const sitemapEntries = matchAll(sitemap, /<url>([\\s\\S]*?)<\\/url>/gi).map((match) => {
  const loc = match[1].match(/<loc>([^<]+)<\\/loc>/i)?.[1] || '';
  const alternates = matchAll(match[1], /<xhtml:link[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"[^>]*\\/>/gi)
    .map((item) => ({ language: item[1], url: item[2] }));
  return { loc, alternates };
});
const sitemapUrls = sitemapEntries.map((entry) => entry.loc);
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap URLs must be unique');
assert.deepEqual(new Set(sitemapUrls), expectedUrls, 'Sitemap must contain the homepage and every generated product language page, with no stale URLs');

for (const [slug, group] of productGroups) {
  const expectedLanguages = new Set(group.map((item) => item.page.language));
  for (const { canonical, alternates } of group) {
    const actualLanguages = new Set(alternates.filter((item) => item.language !== 'x-default').map((item) => item.language));
    assert.deepEqual(actualLanguages, expectedLanguages, `${slug}: each page must advertise the same available languages`);
    for (const alternate of alternates) {
      assert.ok(expectedUrls.has(alternate.url), `${slug}: hreflang target must be included in generated pages`);
    }
    const sitemapEntry = sitemapEntries.find((entry) => entry.loc === canonical);
    assert.ok(sitemapEntry, `${canonical}: sitemap entry is required`);
    assert.deepEqual(
      new Set(sitemapEntry.alternates.map((item) => item.language)),
      new Set([...expectedLanguages, 'x-default']),
      `${canonical}: sitemap hreflang entries must match page alternates`
    );
  }
}

const robots = await readFile(path.join(ROOT, 'robots.txt'), 'utf8');
assert.match(robots, /^User-agent:\\s*\\*/m, 'robots.txt must contain a global user-agent rule');
assert.match(robots, /^Allow:\\s*\\//m, 'robots.txt must allow public crawling');
assert.match(robots, new RegExp('^Sitemap:\\s*' + SITE_URL.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '/sitemap\\.xml$', 'm'), 'robots.txt must reference the production sitemap');

console.log(`SEO regression checks passed for homepage, ${pages.length} product language pages, sitemap, hreflang, structured data and robots.txt.`);
