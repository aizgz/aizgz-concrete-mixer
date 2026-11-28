import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://www.aizgz.com';
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

function renderInquiryForm(locale) {
  const form = locale.form;
  return `<section id="inquiry" class="inquiry-section" aria-labelledby="inquiry-title">
    <div class="inquiry-heading">
      <h2 id="inquiry-title">${escapeHtml(form.title)}</h2>
      <p>${escapeHtml(form.intro)}</p>
    </div>
    <form id="custom-inquiry-form" class="inquiry-form">
      <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" class="honeypot">
      <input type="hidden" name="_subject" value="Custom Machinery Solutions Inquiry">
      <div class="form-grid">
        <div class="form-field"><label for="custom-name">${escapeHtml(form.name)}</label><input id="custom-name" name="name" type="text" required autocomplete="name" placeholder="${escapeHtml(form.namePlaceholder)}"></div>
        <div class="form-field"><label for="custom-email">${escapeHtml(form.email)}</label><input id="custom-email" name="email" type="email" required autocomplete="email" placeholder="${escapeHtml(form.emailPlaceholder)}"></div>
        <div class="form-field"><label for="custom-equipment">${escapeHtml(form.equipment)}</label><input id="custom-equipment" name="product_model" type="text" placeholder="${escapeHtml(form.equipmentPlaceholder)}"></div>
        <div class="form-field"><label for="custom-phone">${escapeHtml(form.phone)}</label><input id="custom-phone" name="phone" type="text" autocomplete="tel" placeholder="${escapeHtml(form.phonePlaceholder)}"></div>
        <div class="form-field full"><label for="custom-requirements">${escapeHtml(form.requirements)}</label><textarea id="custom-requirements" name="message" rows="5" required placeholder="${escapeHtml(form.requirementsPlaceholder)}"></textarea></div>
      </div>
      <button id="custom-submit" class="button form-submit" type="submit">${escapeHtml(form.submit)}</button>
      <p id="custom-form-status" class="form-status" role="status" aria-live="polite" hidden></p>
      <p class="form-security">${escapeHtml(form.security)}</p>
    </form>
  </section>`;
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
  const contact = locale.contact;
  const contactMethods = `
    <section class="contact-section" aria-labelledby="contact-methods-title">
      <div class="contact-heading">
        <h2 id="contact-methods-title">${escapeHtml(contact.title)}</h2>
        <p>${escapeHtml(contact.intro)}</p>
      </div>
      <div class="contact-methods">
        <a class="contact-method whatsapp" href="https://wa.me/8615037113544" target="_blank" rel="noopener noreferrer">
          <span class="contact-label">WhatsApp</span>
          <strong>+86 150 3711 3544</strong>
          <span class="contact-action">${escapeHtml(contact.whatsapp)}</span>
        </a>
        <div class="contact-method wechat">
          <span class="contact-label">WeChat</span>
          <strong>+86 150 3711 3544</strong>
          <span class="contact-action">${escapeHtml(contact.wechat)}</span>
        </div>
      </div>
    </section>`;
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
    .cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1.1rem;margin:1.5rem auto 0}
    .info-card{grid-column:span 2;min-height:100%;background:#fff;border:1px solid #e2e8f0;border-radius:.9rem;padding:1.5rem;box-shadow:0 5px 20px #0f172a08}
    .info-card:nth-child(4){grid-column:2/span 2}.info-card:nth-child(5){grid-column:4/span 2}
    .step-card{background:#fff;border:1px solid #e2e8f0;border-radius:.8rem;padding:1.25rem;box-shadow:0 5px 20px #0f172a08}
    .info-card h3{margin:.85rem 0 .55rem}.info-card p{line-height:1.65}
    .contact-section{margin:1.5rem auto 0;padding:clamp(1.5rem,4vw,2.5rem);background:#fff;border:1px solid #e2e8f0;border-radius:1rem}
    .contact-heading{text-align:center;max-width:700px;margin:0 auto 1.25rem}.contact-heading p{color:#475569;margin:.4rem auto}
    .contact-methods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;max-width:820px;margin:auto}
    .contact-method{display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:1.25rem;border:1px solid #e2e8f0;border-radius:.8rem;background:#f8fafc;text-align:center}
    .contact-method.whatsapp{border-color:#bbf7d0;background:#f0fdf4}
    .contact-label{font-weight:800;color:#0f172a}.contact-method strong{font-size:1.15rem;color:#0f172a}
    .contact-action{font-size:.88rem;color:#475569}
    .number,.step-number{display:inline-flex;align-items:center;justify-content:center;width:2.2rem;height:2.2rem;border-radius:50%;background:#fef3c7;color:#92400e;font-size:.8rem;font-weight:800}
    h3{font-size:1.05rem;color:#0f172a;line-height:1.35;margin:.7rem 0 .4rem}.info-card p,.step-card p{font-size:.92rem;color:#475569;margin:0}
    .steps{display:grid;gap:.9rem;max-width:900px;margin:1.5rem auto 0}.step-card{display:flex;gap:1rem;align-items:flex-start}
    .step-card h3{margin:.1rem 0 .35rem}.callout{background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:2rem;text-align:center;margin-top:1rem}
    .callout p{max-width:850px;margin:.6rem auto 1.3rem;color:#475569}
    .inquiry-section{margin:3rem auto 0;padding:clamp(1.5rem,4vw,3rem);background:#0f172a;color:#fff;border-radius:1rem;scroll-margin-top:1.5rem}
    .inquiry-heading{text-align:center;max-width:760px;margin:0 auto 1.5rem}.inquiry-heading h2{color:#fbbf24}
    .inquiry-heading p{color:#cbd5e1;margin:.5rem auto}
    .inquiry-form{max-width:820px;margin:auto;padding:clamp(1rem,3vw,2rem);background:#1e293b;border-radius:.8rem}
    .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
    .form-field{display:flex;flex-direction:column;gap:.4rem}.form-field.full{grid-column:1/-1}
    .form-field label{font-size:.9rem;font-weight:700;color:#e2e8f0}
    .form-field input,.form-field textarea{width:100%;min-width:0;border:1px solid #475569;border-radius:.5rem;padding:.8rem;background:#334155;color:#fff;font:inherit}
    .form-field input::placeholder,.form-field textarea::placeholder{color:#cbd5e1}
    .form-field input:focus,.form-field textarea:focus{outline:2px solid #f59e0b;outline-offset:1px}
    .form-submit{width:100%;margin-top:1.2rem;border:0;cursor:pointer}.form-submit:disabled{opacity:.6;cursor:wait}
    .form-status{margin:1rem 0 0;text-align:center;font-weight:700}.form-security{margin:1rem 0 0;text-align:center;color:#cbd5e1;font-size:.75rem}
    .form-status.success{color:#34d399}.form-status.error{color:#fda4af}
    .honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
    footer{background:#0f172a;color:#cbd5e1;padding:1.5rem 1rem;text-align:center;font-size:.85rem}
    footer a{color:#fbbf24}
    html[dir="rtl"] body{text-align:right}
    @media(max-width:800px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.info-card,.info-card:nth-child(4),.info-card:nth-child(5){grid-column:auto}.info-card:last-child{grid-column:1/-1;max-width:calc(50% - .55rem);justify-self:center}}
    @media(max-width:640px){.header-inner{align-items:flex-start}.top-nav{width:100%;justify-content:space-between}.languages{gap:.6rem}.hero{border-radius:.6rem}.step-card{gap:.7rem}.cards,.contact-methods{grid-template-columns:1fr}.info-card,.info-card:last-child{grid-column:1;max-width:none}.info-card{padding:1.2rem}}
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
      <a class="button" href="#inquiry">${escapeHtml(page.discuss)}</a>
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
      <a class="button" href="#inquiry">${escapeHtml(page.sendInquiry)}</a>
    </section>
    <section class="callout">
      <h2>${escapeHtml(page.closingTitle)}</h2>
      <p>${escapeHtml(page.closingBody)}</p>
      <a class="button" href="#inquiry">${escapeHtml(page.contact)}</a>
    </section>
    ${renderInquiryForm(locale)}
    ${contactMethods}
  </main>
  <footer><a href="/">AIZGZ Machinery</a></footer>
  <script>
    (() => {
      const form = document.getElementById('custom-inquiry-form');
      const status = document.getElementById('custom-form-status');
      const button = document.getElementById('custom-submit');
      const formMessages = ${JSON.stringify(locale.form).replace(/</g, String.fromCharCode(92) + 'u003c')};
      let formspreeId = '';
      fetch('/api/content/?collection=settings', { cache: 'no-store' })
        .then((response) => { if (!response.ok) throw new Error('Settings unavailable'); return response.json(); })
        .then((payload) => { formspreeId = String(payload.settings?.formspree_id || '').trim(); })
        .catch((error) => console.warn('Could not load inquiry settings:', error));
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!formspreeId) {
          status.textContent = formMessages.notConfigured;
          status.className = 'form-status error';
          status.hidden = false;
          return;
        }
        button.disabled = true;
        button.textContent = formMessages.sending;
        status.hidden = true;
        try {
          const response = await fetch('https://formspree.io/f/' + encodeURIComponent(formspreeId), {
            method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }
          });
          if (!response.ok) throw new Error('Inquiry submission failed: ' + response.status);
          status.textContent = formMessages.sent;
          status.className = 'form-status success';
          status.hidden = false;
          form.reset();
        } catch (error) {
          console.error(error);
          status.textContent = formMessages.sendError;
          status.className = 'form-status error';
          status.hidden = false;
        } finally {
          button.disabled = false;
          button.textContent = formMessages.submit;
        }
      });
    })();
  </script>
</body>
</html>
`;
}
function renderHomepageSection(content) {
  const home = content.en.home;
  const optionCards = home.options.map((_, index) => `
          <li class="customization-option-card"><h3 class="font-bold text-slate-900" data-i18n="custom_option_${index + 1}">${escapeHtml(home.options[index])}</h3></li>`).join('');
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
          <style>
            #customization .customization-options-grid{display:grid;grid-template-columns:1fr;gap:1.25rem}
            #customization .customization-option-card{min-width:0;border:1px solid #e2e8f0;border-radius:.75rem;background:#f8fafc;padding:1.5rem}
            #customization .customization-option-card h3{font-weight:700;color:#0f172a;line-height:1.45}
            @media(min-width:640px){#customization .customization-options-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(min-width:1024px){#customization .customization-options-grid{grid-template-columns:repeat(6,minmax(0,1fr))}#customization .customization-option-card{grid-column:span 2}#customization .customization-option-card:nth-child(4){grid-column:2/span 2}#customization .customization-option-card:nth-child(5){grid-column:4/span 2}}
          </style>
          <ul class="customization-options-grid">${optionCards}
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
  const translationPattern = /    const customizationTranslations = \{[\s\S]*?\};/;
  if (!translationPattern.test(homepage)) throw new Error('Homepage customization translations were not found');
  homepage = homepage.replace(translationPattern, translationBlock);
  const dirLine = `      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';`;
  if (!homepage.includes('customPageLink')) {
    if (!homepage.includes(dirLine)) throw new Error('Language switcher direction line was not found');
    homepage = homepage.replace(dirLine, dirLine + `
      const customPageLink = document.getElementById('custom-machinery-link');
      if (customPageLink) customPageLink.href = language === 'en' ? '/custom-machinery-solutions/' : '/' + language + '/custom-machinery-solutions/';`);
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
