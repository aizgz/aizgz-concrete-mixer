import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://aizgz.vercel.app';
const DATA_PATH = path.join(ROOT, 'content', 'custom-machinery-solutions.json');
const HOMEPAGE_PATH = path.join(ROOT, 'index.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const LANGUAGE_CODES = ['en', 'es', 'ar', 'ru'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function routeFor(language) {
  return language === 'en' ? '/custom-machinery-solutions/' : `/${language}/custom-machinery-solutions/`;
}
function renderLinks(current, content) {
  return LANGUAGE_CODES.map((language) => {
    const active = language === current ? ' aria-current="page"' : '';
    return `<a href="${routeFor(language)}"${active}>${escapeHtml(content[language].label)}</a>`;
  }).join('\n');
}
function renderPage(language, allContent) {
  const locale = allContent[language];
  const page = locale.page;
  const canonical = SITE_URL + routeFor(language);
  const alternates = LANGUAGE_CODES.map((code) =>
    `<link rel="alternate" hreflang="${allContent[code].htmlLang}" href="${SITE_URL}${routeFor(code)}">`
  );
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${routeFor('en')}">`);
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: locale.seoDescription,
    url: canonical,
    inLanguage: locale.htmlLang,
    isPartOf: { '@type': 'WebSite', name: 'AIZGZ Machinery', url: SITE_URL + '/' }
  }).replace(/</g, String.fromCharCode(92) + 'u003c');
  const optionCards = page.options.map(([title, description], index) => `
        <article class="info-card">
          <span class="number">${String(index + 1).padStart(2, '0')}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
        </article>`).join('');
  const steps = page.steps.map(([title, description], index) => `
        <article class="step-card">
          <span class="step-number">${String(index + 1).padStart(2, '0')}</span>
          <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>
        </article>`).join('');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale.htmlLang)}" dir="${escapeHtml(locale.dir)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(locale.seoTitle)}</title>
  <meta name="description" content="${escapeHtml(locale.seoDescription)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  ${alternates.join('\n  ')}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AIZGZ Machinery">
  <meta property="og:title" content="${escapeHtml(locale.seoTitle)}">
  <meta property="og:description" content="${escapeHtml(locale.seoDescription)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${escapeHtml(locale.ogLocale)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(locale.seoTitle)}">
  <meta name="twitter:description" content="${escapeHtml(locale.seoDescription)}">
  <meta name="theme-color" content="#0f172a">
  <script type="application/ld+json">${structuredData}</script>
  <style>
    :root{color-scheme:light;font-family:Arial,Helvetica,sans-serif;color:#1e293b;background:#f8fafc}
    *{box-sizing:border-box}body{margin:0;line-height:1.7}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}
    .site-header{background:#0f172a;color:#fff}.header-inner,.container{width:min(1120px,calc(100% - 2rem));margin:auto}
    .header-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 0;flex-wrap:wrap}
    .brand{font-size:1.25rem;font-weight:800;letter-spacing:.04em;color:#f59e0b}.brand span{font-size:.7rem;color:#fff;margin-inline-start:.45rem}
    .languages{display:flex;gap:.85rem;flex-wrap:wrap;font-size:.85rem}.languages a{color:#e2e8f0}.languages a[aria-current=page]{color:#fbbf24;font-weight:800;text-decoration:underline}
    .top-nav{display:flex;gap:1rem;align-items:center;font-size:.9rem;color:#e2e8f0}
    main{padding:2.5rem 0 4rem}.breadcrumb{font-size:.85rem;color:#64748b;margin-bottom:1.5rem}
    .hero{background:#0f172a;color:#fff;border-bottom:5px solid #f59e0b;border-radius:1rem;padding:clamp(2rem,6vw,4.5rem);text-align:center}
    .eyebrow{color:#fbbf24;text-transform:uppercase;letter-spacing:.16em;font-size:.75rem;font-weight:800}
    h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.15;margin:.8rem auto 1rem;max-width:900px}
    .hero-subtitle{font-size:clamp(1.05rem,2vw,1.35rem);color:#e2e8f0;max-width:800px;margin:0 auto 1rem}
    .hero-intro{color:#cbd5e1;max-width:800px;margin:0 auto 1.6rem}
    .button{display:inline-block;background:#f59e0b;color:#0f172a;padding:.8rem 1.25rem;border-radius:.55rem;font-weight:800}
    .button:hover{background:#fbbf24;text-decoration:none}
    .section{padding:3rem 0}.section-heading{text-align:center;margin:0 auto 1.5rem;max-width:850px}
    h2{font-size:clamp(1.6rem,3vw,2.25rem);line-height:1.25;color:#0f172a;margin:0 0 .8rem}
    .section-heading p,.copy{color:#475569;max-width:850px;margin:.6rem auto}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1rem;margin-top:1.5rem}
    .info-card,.step-card{background:#fff;border:1px solid #e2e8f0;border-radius:.8rem;padding:1.25rem;box-shadow:0 5px 20px #0f172a08}
    .number,.step-number{display:inline-flex;align-items:center;justify-content:center;width:2.2rem;height:2.2rem;border-radius:50%;background:#fef3c7;color:#92400e;font-size:.8rem;font-weight:800}
    h3{font-size:1.05rem;color:#0f172a;line-height:1.35;margin:.7rem 0 .4rem}.info-card p,.step-card p{font-size:.92rem;color:#475569;margin:0}
    .steps{display:grid;gap:.9rem;max-width:900px;margin:1.5rem auto 0}.step-card{display:flex;gap:1rem;align-items:flex-start}
    .step-card h3{margin:.1rem 0 .35rem}.callout{background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:2rem;text-align:center;margin-top:1rem}
    .callout p{max-width:850px;margin:.6rem auto 1.3rem;color:#475569}
    footer{background:#0f172a;color:#cbd5e1;padding:1.5rem 1rem;text-align:center;font-size:.85rem}
    footer a{color:#fbbf24}
    html[dir="rtl"] body{text-align:right}
    @media(max-width:640px){.header-inner{align-items:flex-start}.top-nav{width:100%;justify-content:space-between}.languages{gap:.6rem}.hero{border-radius:.6rem}.step-card{gap:.7rem}}
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/">AIZGZ <span>MACHINERY</span></a>
      <nav class="top-nav" aria-label="Main navigation">
        <a href="/">${escapeHtml(page.home)}</a>
        <a href="/#products">${escapeHtml(page.products)}</a>
      </nav>
      <nav class="languages" aria-label="Available languages">${renderLinks(language, allContent)}</nav>
    </div>
  </header>
  <main class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">${escapeHtml(page.home)}</a> / <span>${escapeHtml(page.title)}</span></nav>
    <section class="hero">
      <p class="eyebrow">AIZGZ Machinery</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="hero-subtitle">${escapeHtml(page.subtitle)}</p>
      <p class="hero-intro">${escapeHtml(page.intro)}</p>
      <a class="button" href="/#contact">${escapeHtml(page.discuss)}</a>
    </section>
    <section class="section">
      <div class="section-heading"><h2>${escapeHtml(page.catalogTitle)}</h2>
        ${page.catalog.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      </div>
    </section>
    <section class="section">
      <div class="section-heading"><h2>${escapeHtml(page.optionsTitle)}</h2></div>
      <div class="cards">${optionCards}
      </div>
    </section>
    <section class="section">
      <div class="section-heading"><h2>${escapeHtml(page.processTitle)}</h2></div>
      <div class="steps">${steps}
      </div>
    </section>
    <section class="callout">
      <h2>${escapeHtml(page.notListedTitle)}</h2>
      <p>${escapeHtml(page.notListedBody)}</p>
      <a class="button" href="/#contact">${escapeHtml(page.sendInquiry)}</a>
    </section>
    <section class="callout">
      <h2>${escapeHtml(page.closingTitle)}</h2>
      <p>${escapeHtml(page.closingBody)}</p>
      <a class="button" href="/#contact">${escapeHtml(page.contact)}</a>
    </section>
  </main>
  <footer><a href="/">AIZGZ Machinery</a></footer>
</body>
</html>
`;
}
function renderHomepageSection(content) {
  const home = content.en.home;
  const optionCards = home.options.map((_, index) => `
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-6"><h3 class="font-bold text-slate-900" data-i18n="custom_option_${index + 1}">${escapeHtml(home.options[index])}</h3></div>`).join('');
  return `<section id="customization" class="border-b border-slate-200 bg-white px-4 py-16">
      <div class="mx-auto max-w-7xl">
        <div class="mx-auto mb-10 max-w-3xl text-center">
          <h2 class="mb-3 text-3xl font-bold text-slate-900" data-i18n="custom_title">${escapeHtml(home.title)}</h2>
          <p class="text-sm leading-relaxed text-slate-600 md:text-base" data-i18n="custom_subtitle">${escapeHtml(home.subtitle)}</p>
          <p class="text-sm leading-relaxed text-slate-600 md:text-base" data-i18n="custom_intro">${escapeHtml(home.intro)}</p>
          <p class="mt-3 text-sm leading-relaxed text-slate-600 md:text-base" data-i18n="custom_detail">${escapeHtml(home.detail)}</p>
        </div>
        <div class="mx-auto max-w-5xl">
          <h3 class="mb-4 text-center font-bold text-slate-900" data-i18n="custom_options_title">${escapeHtml(home.optionsTitle)}</h3>
          <ul class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">${optionCards}
          </ul>
          <p class="mx-auto mt-6 max-w-4xl text-center text-sm leading-relaxed text-slate-600" data-i18n="custom_note">${escapeHtml(home.note)}</p>
          <div class="mt-6 text-center"><a id="custom-machinery-link" href="/custom-machinery-solutions/" class="inline-flex rounded-lg bg-amber-500 px-6 py-3 font-bold text-slate-900 hover:bg-amber-600" data-i18n="custom_cta">${escapeHtml(home.cta)}</a></div>
        </div>
      </div>
    </section>`;
}
function buildHomepageTranslations(content) {
  const translations = {};
  for (const language of LANGUAGE_CODES) {
    const home = content[language].home;
    translations[language] = {
      custom_title: home.title,
      custom_subtitle: home.subtitle,
      custom_intro: home.intro,
      custom_detail: home.detail,
      custom_options_title: home.optionsTitle,
      ...Object.fromEntries(home.options.map((value, index) => [`custom_option_${index + 1}`, value])),
      custom_note: home.note,
      custom_cta: home.cta
    };
  }
  return translations;
}
async function updateHomepage(content) {
  let homepage = await readFile(HOMEPAGE_PATH, 'utf8');
  const sectionPattern = /<section id="customization"[\s\S]*?<\/section>/;
  if (!sectionPattern.test(homepage)) throw new Error('Homepage customization section was not found');
  homepage = homepage.replace(sectionPattern, renderHomepageSection(content));
  const translations = JSON.stringify(buildHomepageTranslations(content), null, 2)
    .split('\n').map((line, index) => index === 0 ? line : '      ' + line).join('\n');
  const translationBlock = `    const customizationTranslations = ${translations};`;
  const translationPattern = /    const customizationTranslations = \{[\s\S]*?\n    \};/;
  if (!translationPattern.test(homepage)) throw new Error('Homepage customization translations were not found');
  homepage = homepage.replace(translationPattern, translationBlock);
  const dirLine = `      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';`;
  if (!homepage.includes('customPageLink')) {
    if (!homepage.includes(dirLine)) throw new Error('Language switcher direction line was not found');
    homepage = homepage.replace(dirLine, dirLine + `
      const customPageLink = document.getElementById('custom-machinery-link');
      if (customPageLink) customPageLink.href = language === 'en' ? '/custom-machinery-solutions/' : `/${language}/custom-machinery-solutions/`;`);
  }
  await writeFile(HOMEPAGE_PATH, homepage, 'utf8');
}
async function updateSitemap(content) {
  const current = await readFile(SITEMAP_PATH, 'utf8');
  if (!current.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) {
    throw new Error('Generated sitemap is missing the XHTML namespace');
  }
  const entries = [...current.matchAll(/<url>[\s\S]*?<\/url>/g)].map((match) => match[0]);
  const known = new Set(entries.map((entry) => entry.match(/<loc>([^<]+)<\/loc>/)?.[1]).filter(Boolean));
  for (const language of LANGUAGE_CODES) {
    const loc = SITE_URL + routeFor(language);
    if (known.has(loc)) continue;
    const alternates = LANGUAGE_CODES.map((code) =>
      `    <xhtml:link rel="alternate" hreflang="${content[code].htmlLang}" href="${SITE_URL}${routeFor(code)}" />`
    );
    alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${routeFor('en')}" />`);
    entries.push(['  <url>', `    <loc>${loc}</loc>`, ...alternates, '  </url>'].join('\n'));
  }
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
  await writeFile(SITEMAP_PATH, sitemap, 'utf8');
}
async function main() {
  const content = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  for (const language of LANGUAGE_CODES) {
    if (!content[language]?.page || !content[language]?.home) throw new Error(`Missing custom machinery content for ${language}`);
    const output = path.join(ROOT, routeFor(language).replace(/^\//, ''), 'index.html');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, renderPage(language, content), 'utf8');
  }
  await updateHomepage(content);
  await updateSitemap(content);
  console.log('Generated four localized custom machinery pages, updated the homepage module and sitemap.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
