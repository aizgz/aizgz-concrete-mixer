import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_URL = 'https://www.aizgz.com';
const LANGUAGES = ['en', 'es', 'ar', 'ru'];
const PRODUCT_ROOTS = [
  ['en', path.join(ROOT, 'products')],
  ...LANGUAGES.filter((language) => language !== 'en')
    .map((language) => [language, path.join(ROOT, language, 'products')])
];

function matchAll(text, pattern) {
  return [...text.matchAll(pattern)];
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
assert.match(homepage, /<title>[^<]+<\/title>/i, 'Homepage must have a title');
assert.match(homepage, /<meta\s+name="description"\s+content="[^"]+">/i, 'Homepage must have a meta description');
assert.ok(homepage.includes('<link rel="canonical" href="' + SITE_URL + '/">'), 'Homepage canonical must point to the production URL');

const pages = await collectProductPages();
assert.ok(pages.length > 0, 'Build must generate product detail pages');
assert.equal(pages.length, 44, 'Build must generate 8 current products in four languages plus 12 archived English URLs');
const productTranslations = JSON.parse(await readFile(path.join(ROOT, 'content', 'product-translations.json'), 'utf8'));
assert.equal(Object.keys(productTranslations).length, 8, 'All eight current products must have translation records');


const homepageRoutes = { en: '/', es: '/es/', ar: '/ar/', ru: '/ru/' };
const expectedUrls = new Set(Object.values(homepageRoutes).map((route) => SITE_URL + route));
for (const [language, route] of Object.entries(homepageRoutes)) {
  const file = path.join(ROOT, route === '/' ? 'index.html' : route.slice(1) + 'index.html');
  const html = await readFile(file, 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';
  assert.equal(canonical, SITE_URL + route, file + ': homepage canonical must match its language route');
  assert.match(html, new RegExp('<html lang="' + language + '"' + (language === 'ar' ? ' dir="rtl"' : '')), file + ': homepage language and direction must be correct');
  if (language !== 'en') {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
    const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '';
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] || '';
    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] || '';
    const twitterTitle = html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i)?.[1] || '';
    const twitterDescription = html.match(/<meta\s+name="twitter:description"\s+content="([^"]+)"/i)?.[1] || '';
    assert.ok(title.trim(), file + ': localized homepage title is required');
    assert.ok(description.trim() && description.length <= 160, file + ': localized homepage description must be concise');
    assert.equal(ogTitle, title, file + ': Open Graph title must match the localized title');
    assert.equal(ogDescription, description, file + ': Open Graph description must match the localized description');
    assert.equal(twitterTitle, title, file + ': Twitter title must match the localized title');
    assert.equal(twitterDescription, description, file + ': Twitter description must match the localized description');
    const focusTerms = {
      es: /mortero seco|mezcla de polvo|ensacadoras de válvula/i,
      ar: /الملاط الجاف|خلط المساحيق|الأكياس ذات الصمام/,
      ru: /сухих строительных смесей|смешивания порошков|клапанные фасовочные машины/i
    };
    assert.match(title + ' ' + description, focusTerms[language], file + ': localized SEO metadata must reflect the current dry-mortar and powder-equipment focus');
  }
  const alternates = matchAll(html, /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*>/gi)
    .map((match) => ({ language: match[1], url: match[2] }));
  assert.deepEqual(new Set(alternates.map((item) => item.language)), new Set(['en', 'es', 'ar', 'ru', 'x-default']), file + ': homepage hreflang set must be complete');
  assert.ok(alternates.some((item) => item.language === language && item.url === canonical), file + ': homepage self hreflang is required');
}
assert.match(homepage, /navigator\.languages/, 'First-visit language must use browser preferred languages');
assert.ok(!homepage.includes('countryLanguageChoice'), 'Country-based language override must not replace browser language');
const homepageUiTranslations = {
  en: { title: 'Dry Mix Mortar Production Lines & Powder Processing Equipment', dry: 'Dry Mortar Production Systems', packaging: 'Packaging Equipment', mixing: 'Mixing & Blending Equipment' },
  es: { title: 'Líneas de producción de mortero seco y equipos para procesar polvos', dry: 'Sistemas de producción de mortero seco', packaging: 'Equipos de envasado', mixing: 'Equipos de mezcla y homogeneización' },
  ar: { title: 'خطوط إنتاج الملاط الجاف ومعدات معالجة المساحيق', dry: 'أنظمة إنتاج الملاط الجاف', packaging: 'معدات التعبئة', mixing: 'معدات الخلط والمزج' },
  ru: { title: 'Линии сухих строительных смесей и оборудование для обработки порошков', dry: 'Линии производства сухих смесей', packaging: 'Фасовочное оборудование', mixing: 'Оборудование для смешивания' }
};
for (const [language, labels] of Object.entries(homepageUiTranslations)) {
  const route = homepageRoutes[language];
  const file = path.join(ROOT, route === '/' ? 'index.html' : route.slice(1) + 'index.html');
  const html = await readFile(file, 'utf8');
  assert.ok(html.includes('"hero_title":"' + labels.title + '"'), file + ': hero title translation must match the current equipment focus');
  for (const [key, value] of [['filter_dry_systems', labels.dry], ['filter_packaging', labels.packaging], ['filter_mixing', labels.mixing]]) {
    assert.ok(html.includes('"' + key + '":"' + value + '"'), file + ': localized category filter ' + key + ' is required');
  }
  assert.match(html, /id="product-filters" class="mb-8 flex flex-wrap gap-3"/, file + ': category filters must wrap on narrow screens');
}
assert.match(homepage, /font-size:clamp\(1\.875rem,4vw,3\.75rem\)/, 'Hero heading must scale progressively across viewport sizes');
const customMachineryPages = [];
for (const language of LANGUAGES) {
  const route = language === 'en' ? '/custom-machinery-solutions/' : '/' + language + '/custom-machinery-solutions/';
  const file = path.join(ROOT, route.replace(/^\//, ''), 'index.html');
  const html = await readFile(file, 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '';
  assert.ok(title.trim(), file + ': title is required');
  assert.ok(description.trim(), file + ': meta description is required');
  assert.ok(description.length <= 160, file + ': homepage meta description should be concise (160 characters or fewer)');
  assert.equal(canonical, SITE_URL + route, file + ': canonical must match its language route');
  assert.match(html, new RegExp('<html lang="' + language + '" dir="' + (language === 'ar' ? 'rtl' : 'ltr') + '">'), file + ': language and text direction must be correct');
  assert.match(html, /Machinery|Maquinaria|المعدات|оборудования/i, file + ': localized page content is required');
  assert.match(html, /<section id="inquiry"/, file + ': an on-page inquiry section is required');
  assert.match(html, /<form id="custom-inquiry-form"/, file + ': an on-page inquiry form is required');
  assert.match(html, /const formspreeIdPromise = fetch\('\/api\/content\/\?collection=settings'/, file + ': inquiry settings must be loaded as a promise');
  assert.match(html, /const formspreeId = await formspreeIdPromise/, file + ': submission must wait for inquiry settings before checking configuration');
  assert.match(html, /button\.disabled = true;[\s\S]*?const formspreeId = await formspreeIdPromise/, file + ': submit control must be locked while settings load');
  for (const field of ['name', 'email', 'product_model', 'phone', 'message']) {
    assert.match(html, new RegExp('<(?:input|textarea)[^>]+name="' + field + '"'), file + ': inquiry field ' + field + ' is required');
  }
  assert.equal((html.match(/<a class="button" href="#inquiry">/g) || []).length, 3, file + ': all three inquiry calls to action must target the on-page form');
  assert.ok(!html.includes('href="/#contact"'), file + ': inquiry calls to action must not send visitors back to the homepage');
  assert.equal((html.match(/class="contact-method(?: whatsapp| wechat)?"/g) || []).length, 2, file + ': WhatsApp and WeChat contact methods are required');
  assert.ok(html.includes('https://wa.me/8615037113544'), file + ': WhatsApp link must use the supplied contact number');
  assert.ok(html.includes('+86 150 3711 3544'), file + ': WhatsApp and WeChat number must be displayed');
  assert.match(html, /\.cards\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/, file + ': customization cards must use the balanced desktop grid');
  const alternates = matchAll(html, /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*>/gi)
    .map((match) => ({ language: match[1], url: match[2] }));
  assert.equal(new Set(alternates.map((item) => item.language)).size, alternates.length, file + ': hreflang values must be unique');
  assert.ok(alternates.some((item) => item.language === language && item.url === canonical), file + ': self hreflang is required');
  assert.ok(alternates.some((item) => item.language === 'x-default' && item.url === SITE_URL + '/custom-machinery-solutions/'), file + ': x-default alternate is required');
  expectedUrls.add(canonical);
  customMachineryPages.push({ language, canonical, alternates });
}
const expectedStructuredSpecs = {
  '100000-tpy-pre-mixed-mortar-production-line': ['100,000 tons/year'],
  '300000-tpy-pre-mixed-mortar-production-line': ['300,000 tons/year', '6 m³', '6–8 tons/batch'],
  'automatic-weighing-valve-bagging-machine': ['Approximately 8 tons/hour', 'AC 380 V', '0.4–0.6 MPa'],
  'compact-standalone-dry-mortar-production-line': ['10–20 tons/day', '1 ton/batch'],
  'horizontal-ploughshare-mixer': ['LDH-0.1 to LDH-4', '40–2,400 kg/batch'],
  'horizontal-ribbon-mixer': ['HJJ300–HJJ5000', '300–5,000 kg/batch'],
  'pneumatic-valve-bagging-machine': ['10–50 kg', '3–6 bags/min', '0.4–0.8 MPa'],
  'twin-shaft-gravity-free-mixing-production-line': ['3–5 tons/hour', '18.5 kW main drive']
};
const productGroups = new Map();
for (const page of pages) {
  const html = await readFile(page.file, 'utf8');
  if (productTranslations[page.slug] && page.language !== 'en') {
    const translated = productTranslations[page.slug][page.language];
    assert.ok(translated && html.includes(translated.title), page.file + ': localized product title must be rendered');
    assert.ok(html.includes(translated.summary), page.file + ': localized product summary must be rendered');
    assert.ok(html.includes(translated.body.split('\n').find((line) => line && !line.startsWith('#'))), page.file + ': localized product body must be rendered');
    assert.match(html, new RegExp('<html lang="' + page.language + '"' + (page.language === 'ar' ? ' dir="rtl"' : '')), page.file + ': product language and direction must be correct');
    assert.ok(html.includes('aria-current="page"'), page.file + ': current language must be marked in the language switcher');
    assert.ok(!html.includes('<dt>Capacity / Throughput</dt>'), page.file + ': specification labels must be localized');
  }
  if (expectedStructuredSpecs[page.slug] && page.language === 'en') {
    for (const value of expectedStructuredSpecs[page.slug]) {
      assert.ok(html.includes(value), page.file + ': structured key specification "' + value + '" must be rendered from product data');
    }
  }
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] || '';
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';
  assert.ok(title.trim(), page.file + ': title is required');
  assert.ok(description.trim(), page.file + ': meta description is required');
  const expectedCanonical = SITE_URL + (page.language === 'en' ? '' : '/' + page.language) + '/products/' + page.slug + '/';
  assert.equal(canonical, expectedCanonical, page.file + ': canonical must match its language route');
  assert.match(html, /<script\s+type="application\/ld\+json">[\s\S]*?"@type":"Product"[\s\S]*?<\/script>/i, page.file + ': Product structured data is required');
  const schemaText = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] || '';
  const schema = JSON.parse(schemaText);
  const breadcrumb = schema['@graph']?.find((item) => item['@type'] === 'BreadcrumbList');
  const localizedHome = SITE_URL + (page.language === 'en' ? '/' : '/' + page.language + '/');
  assert.ok(breadcrumb, page.file + ': BreadcrumbList structured data is required');
  assert.equal(breadcrumb.itemListElement?.[0]?.item, localizedHome, page.file + ': breadcrumb home must use the current language');
  assert.equal(breadcrumb.itemListElement?.[1]?.item, localizedHome + '#products', page.file + ': breadcrumb product catalogue must use the current language');
  assert.ok(html.includes('<a class="brand" href="' + localizedHome + '">'), page.file + ': brand link must remain in the current language');

  const alternates = matchAll(html, /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*>/gi)
    .map((match) => ({ language: match[1], url: match[2] }));
  assert.ok(alternates.some((item) => item.language === 'x-default' && item.url === SITE_URL + '/products/' + page.slug + '/'), page.file + ': x-default alternate is required');
  assert.ok(alternates.some((item) => item.language === page.language && item.url === canonical), page.file + ': self hreflang is required');
  assert.equal(new Set(alternates.map((item) => item.language)).size, alternates.length, page.file + ': hreflang values must be unique');

  expectedUrls.add(canonical);
  const group = productGroups.get(page.slug) || [];
  group.push({ page, canonical, alternates });
  productGroups.set(page.slug, group);
}

const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
assert.match(sitemap, /<urlset[^>]+xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/, 'Sitemap must declare the XHTML namespace');
const sitemapEntries = matchAll(sitemap, /<url>([\s\S]*?)<\/url>/gi).map((match) => {
  const loc = match[1].match(/<loc>([^<]+)<\/loc>/i)?.[1] || '';
  const alternates = matchAll(match[1], /<xhtml:link[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"[^>]*\/>/gi)
    .map((item) => ({ language: item[1], url: item[2] }));
  return { loc, alternates };
});
const sitemapUrls = sitemapEntries.map((entry) => entry.loc);
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap URLs must be unique');
assert.deepEqual(new Set(sitemapUrls), expectedUrls, 'Sitemap must contain all four homepage language URLs and every generated page, with no stale URLs');

for (const [slug, group] of productGroups) {
  const expectedLanguages = new Set(group.map((item) => item.page.language));
  for (const { canonical, alternates } of group) {
    const actualLanguages = new Set(alternates.filter((item) => item.language !== 'x-default').map((item) => item.language));
    assert.deepEqual(actualLanguages, expectedLanguages, slug + ': each page must advertise the same available languages');
    for (const alternate of alternates) {
      assert.ok(expectedUrls.has(alternate.url), slug + ': hreflang target must be included in generated pages');
    }
    const sitemapEntry = sitemapEntries.find((entry) => entry.loc === canonical);
    assert.ok(sitemapEntry, canonical + ': sitemap entry is required');
    assert.deepEqual(
      new Set(sitemapEntry.alternates.map((item) => item.language)),
      new Set([...expectedLanguages, 'x-default']),
      canonical + ': sitemap hreflang entries must match page alternates'
    );
  }
}


for (const { language, canonical, alternates } of customMachineryPages) {
  const actualLanguages = new Set(alternates.filter((item) => item.language !== 'x-default').map((item) => item.language));
  assert.deepEqual(actualLanguages, new Set(LANGUAGES), canonical + ': every custom machinery page must advertise all four languages');
  for (const alternate of alternates) {
    assert.ok(expectedUrls.has(alternate.url), canonical + ': hreflang target must be included in generated pages');
  }
  const sitemapEntry = sitemapEntries.find((entry) => entry.loc === canonical);
  assert.ok(sitemapEntry, canonical + ': sitemap entry is required');
  assert.deepEqual(
    new Set(sitemapEntry.alternates.map((item) => item.language)),
    new Set([...LANGUAGES, 'x-default']),
    canonical + ': sitemap hreflang entries must include all custom machinery languages'
  );
}

const robots = await readFile(path.join(ROOT, 'robots.txt'), 'utf8');
assert.match(robots, /^User-agent:\s*\*/m, 'robots.txt must contain a global user-agent rule');
assert.match(robots, /^Allow:\s*\//m, 'robots.txt must allow public crawling');
assert.ok(robots.includes('Sitemap: ' + SITE_URL + '/sitemap.xml'), 'robots.txt must reference the production sitemap');

console.log('SEO regression checks passed for homepage, ' + pages.length + ' product language pages, four custom machinery pages, sitemap, hreflang, structured data and robots.txt.');
