import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'content', 'products');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'product.html');
const SITE_URL = 'https://www.aizgz.com';
const LANGUAGES = {
  en: { htmlLang: 'en', ogLocale: 'en_US', dir: 'ltr', label: 'English', home: 'Home', products: 'Products', inquiry: 'Request a quotation', back: 'Back to product catalogue', footer: 'Product information and configuration are subject to confirmation.', titleKey: 'title', bodyKey: null },
  es: { htmlLang: 'es', ogLocale: 'es_ES', dir: 'ltr', label: 'Español', home: 'Inicio', products: 'Productos', inquiry: 'Solicitar presupuesto', back: 'Volver al catálogo de productos', footer: 'La información y configuración del producto están sujetas a confirmación.', titleKey: 'title_es', bodyKey: 'body_es' },
  ar: { htmlLang: 'ar', ogLocale: 'ar_AR', dir: 'rtl', label: 'العربية', home: 'الرئيسية', products: 'المنتجات', inquiry: 'طلب عرض سعر', back: 'العودة إلى كتالوج المنتجات', footer: 'تخضع معلومات المنتج وتكوينه للتأكيد.', titleKey: 'title_ar', bodyKey: 'body_ar' },
  ru: { htmlLang: 'ru', ogLocale: 'ru_RU', dir: 'ltr', label: 'Русский', home: 'Главная', products: 'Продукция', inquiry: 'Запросить предложение', back: 'Вернуться в каталог продукции', footer: 'Информация о продукте и его конфигурация подлежат подтверждению.', titleKey: 'title_ru', bodyKey: 'body_ru' }
};
const SPEC_FIELDS = [
  ['model', 'Model'], ['category', 'Category'], ['capacity', 'Capacity / Throughput'],
  ['internal_capacity', 'Internal Material Capacity'], ['voltage', 'Voltage'],
  ['frequency', 'Frequency'], ['motor_power', 'Motor Power'],
  ['packaging_range', 'Packaging Range'], ['mixing_volume', 'Mixing Volume'],
  ['mixing_time', 'Mixing Time'], ['power_type', 'Power / Control Type'],
  ['supply_status', 'Supply Status'], ['application', 'Application'],
  ['optional_components', 'Optional Components']
];

function parseScalar(value) {
  const text = value.trim();
  if (!text) return '';
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  if (text === 'null' || text === '~') return '';
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text.replace(/\s+#.*$/, '').trim();
}

// CMS product front matter uses scalar values and YAML literal blocks.
function parseFrontMatter(source, filename) {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${filename}: missing YAML front matter`);
  const lines = match[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const field = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!field) throw new Error(`${filename}:${i + 1}: unsupported front matter syntax`);
    const key = field[1];
    const raw = field[2] || '';
    if (raw === '|' || raw === '|-' || raw === '>' || raw === '>-') {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || !lines[i + 1].trim())) {
        i += 1;
        block.push(lines[i].replace(/^ {1,2}/, ''));
      }
      data[key] = block.join(raw.startsWith('>') ? ' ' : '\n').trim();
      continue;
    }
    if (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
      const continuation = [raw];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        i += 1;
        continuation.push(lines[i].trim());
      }
      data[key] = parseScalar(continuation.filter(Boolean).join(' '));
      continue;
    }
    data[key] = parseScalar(raw);
  }
  return { data, body: source.slice(match[0].length).trim() };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[char]);
}
function safeImagePath(value) {
  const image = String(value || '').trim();
  return image.startsWith('/') && !image.startsWith('//') && !image.includes('..') ? image : '';
}
function renderInline(markdown) {
  let html = escapeHtml(markdown);
  html = html.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}
function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const output = [];
  let paragraph = [];
  let list = [];
  let table = [];
  const flushParagraph = () => {
    if (paragraph.length) output.push('<p>' + paragraph.map(renderInline).join('<br>') + '</p>');
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push('<ul>' + list.map((item) => '<li>' + renderInline(item) + '</li>').join('') + '</ul>');
    list = [];
  };
  const splitCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
  const isSeparator = (line) => splitCells(line).every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.map(splitCells);
    const hasHeader = rows.length > 1 && isSeparator(table[1]);
    const header = hasHeader ? rows[0] : [];
    const bodyRows = hasHeader ? rows.slice(2) : rows;
    const headHtml = header.length ? '<thead><tr>' + header.map((cell) => '<th scope="col">' + renderInline(cell) + '</th>').join('') + '</tr></thead>' : '';
    const bodyHtml = '<tbody>' + bodyRows.map((row) => '<tr>' + row.map((cell) => '<td>' + renderInline(cell) + '</td>').join('') + '</tr>').join('') + '</tbody>';
    output.push('<div class="table-scroll"><table>' + headHtml + bodyHtml + '</table></div>');
    table = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    const tableStart = line.trim().startsWith('|') && next.trim().startsWith('|') && isSeparator(next);
    const tableContinuation = table.length > 0 && line.trim().startsWith('|');
    if (tableStart || tableContinuation) {
      flushParagraph(); flushList(); table.push(line); continue;
    }
    if (table.length) flushTable();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 6);
      output.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
    } else if (item) {
      flushParagraph(); list.push(item[1]);
    } else {
      flushList(); paragraph.push(line.trim());
    }
  }
  flushParagraph(); flushList(); flushTable();
  return output.join('\n');
}
function plainText(markdown) {
  return String(markdown || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function makeDescription(meta, body, language) {
  const summaryKey = language === 'en' ? 'summary' : `summary_${language}`;
  const source = meta[summaryKey] || plainText(body);
  return source ? (source.length > 160 ? `${source.slice(0, 157).trimEnd()}...` : source)
    : 'Product details, specifications and configuration options from AIZGZ Machinery.';
}

function isDisplayableHomepageValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '' &&
    !/^(["']{2}|null|undefined|n\/a)$/i.test(String(value).trim()) &&
    !/[\u3400-\u9fff]/.test(String(value));
}
function renderHomepageProductCard(meta, slug) {
  const title = escapeHtml(meta.title || 'Industrial Equipment');
  const image = safeImagePath(meta.image);
  const imageHtml = image
    ? `<picture class="block"><source type="image/webp" srcset="${escapeHtml(image)}.400.webp 400w, ${escapeHtml(image)}.800.webp 800w" sizes="(min-width: 1280px) 393px, (min-width: 1024px) calc((100vw - 96px) / 3), (min-width: 768px) calc((100vw - 64px) / 2), calc(100vw - 32px)"><img src="${escapeHtml(image)}" alt="${title}" loading="lazy" decoding="async" class="h-full w-full object-cover" onerror="this.parentElement.querySelector('source').remove();this.onerror=null;"></picture>`
    : '';
  const model = isDisplayableHomepageValue(meta.model)
    ? `<p class="mt-1 font-mono text-xs text-slate-600">Model: ${escapeHtml(meta.model)}</p>` : '';
  const capacity = isDisplayableHomepageValue(meta.capacity)
    ? `<p class="mt-2 text-sm text-slate-600"><strong>Capacity: </strong>${escapeHtml(meta.capacity)}</p>` : '';
  const internalCapacity = isDisplayableHomepageValue(meta.internal_capacity)
    ? `<p class="mt-2 text-sm text-slate-600"><strong>Internal Capacity: </strong>${escapeHtml(meta.internal_capacity)}</p>` : '';
  return [
    '<article class="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-100 bg-white shadow-md transition duration-300 hover:shadow-xl">',
    `<a href="/products/${slug}/" class="block flex-1 text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700">`,
    `<div class="relative h-48 overflow-hidden bg-slate-100">${imageHtml}</div>`,
    `<div class="p-6"><h3 class="text-xl font-bold text-slate-800">${title}</h3>${model}${capacity}${internalCapacity}</div>`,
    '</a>',
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 p-6 pt-4">',
    `<a href="#contact" class="rounded bg-amber-500 px-4 py-2 text-xs font-bold text-slate-900 hover:bg-amber-600" aria-label="Inquire: ${title}">Inquire →</a>`,
    '</div>',
    '</article>'
  ].join('');
}

function renderSpecs(meta) {
  return SPEC_FIELDS.filter(([key]) => meta[key] !== undefined && meta[key] !== null && String(meta[key]).trim())
    .map(([key, label]) => `<div class="spec"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(meta[key])}</dd></div>`).join('\n');
}
function renderLanguageLinks(slug, available, current) {
  return available.map((language) => {
    const href = language === 'en' ? `/products/${slug}/` : `/${language}/products/${slug}/`;
    const active = language === current ? ' aria-current="page"' : '';
    return `<a href="${href}"${active}>${LANGUAGES[language].label}</a>`;
  }).join('\n');
}
function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '');
}

async function main() {
  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const files = (await readdir(PRODUCTS_DIR)).filter((name) => name.toLowerCase().endsWith('.md')).sort();
  const archiveDir = path.join(ROOT, 'content', 'product-archive');
  let archivedFiles = [];
  try { archivedFiles = (await readdir(archiveDir)).filter((name) => name.toLowerCase().endsWith('.md')).sort(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const products = [];
  const seenSlugs = new Set();
  for (const [directory, names, archived] of [[PRODUCTS_DIR, files, false], [archiveDir, archivedFiles, true]]) {
   for (const filename of names) {
    const source = await readFile(path.join(directory, filename), 'utf8');
    const { data: meta, body: englishBody } = parseFrontMatter(source, filename);
    if (archived) meta.catalog_visible = false;
    const slug = String(meta.url_slug || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filename}: invalid or missing url_slug "${slug}"`);
    if (seenSlugs.has(slug)) throw new Error(`Duplicate product url_slug: ${slug}`);
    seenSlugs.add(slug);
    if (!String(meta.title || '').trim() || !englishBody.trim()) throw new Error(`${filename}: English title and body are required`);
    products.push({ meta, slug, englishBody });
   }
  }

  let pageCount = 0;
  const homepageLanguages = [
    { code: 'en', hreflang: 'en', route: '/' },
    { code: 'es', hreflang: 'es', route: '/es/' },
    { code: 'ar', hreflang: 'ar', route: '/ar/' },
    { code: 'ru', hreflang: 'ru', route: '/ru/' }
  ];
  const homepageAlternates = [
    ...homepageLanguages.map(({ hreflang, route }) => ({ hreflang, href: `${SITE_URL}${route}` })),
    { hreflang: 'x-default', href: `${SITE_URL}/` }
  ];
  const sitemapEntries = homepageLanguages.map(({ route }) => ({
    loc: `${SITE_URL}${route}`,
    alternates: homepageAlternates
  }));
  for (const { meta, slug, englishBody } of products) {
    const available = ['en', ...['es', 'ar', 'ru'].filter((language) =>
      String(meta[LANGUAGES[language].titleKey] || '').trim() &&
      String(meta[LANGUAGES[language].bodyKey] || '').trim()
    )];
    for (const language of available) {
      const config = LANGUAGES[language];
      const title = String(meta[config.titleKey] || '').trim();
      const body = language === 'en' ? englishBody : String(meta[config.bodyKey]).trim();
      const route = language === 'en' ? `/products/${slug}/` : `/${language}/products/${slug}/`;
      const canonical = `${SITE_URL}${route}`;
      const sitemapAlternates = available.map((code) => ({
        hreflang: code === 'en' ? 'en' : LANGUAGES[code].htmlLang,
        href: `${SITE_URL}${code === 'en' ? `/products/${slug}/` : `/${code}/products/${slug}/`}`
      }));
      sitemapAlternates.push({ hreflang: 'x-default', href: `${SITE_URL}/products/${slug}/` });
      sitemapEntries.push({ loc: canonical, alternates: sitemapAlternates });
      const description = makeDescription(meta, body, language);
      const image = safeImagePath(meta.image);
      const alternates = available.map((code) => {
        const href = code === 'en' ? `/products/${slug}/` : `/${code}/products/${slug}/`;
        return `<link rel="alternate" hreflang="${LANGUAGES[code].htmlLang}" href="${SITE_URL}${href}">`;
      });
      alternates.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/products/${slug}/">`);
      const html = fillTemplate(template, {
        HTML_LANG: config.htmlLang, OG_LOCALE: config.ogLocale, DIR: config.dir,
        TITLE: escapeHtml(`${title} | AIZGZ`),
        DESCRIPTION: escapeHtml(description), CANONICAL: canonical,
        ALTERNATES: alternates.join('\n  '), OG_TITLE: escapeHtml(title),
        OG_DESCRIPTION: escapeHtml(description), OG_URL: canonical,
        OG_IMAGE: image ? `<meta property="og:image" content="${SITE_URL}${escapeHtml(image)}">` : '',
        TWITTER_IMAGE: image ? `<meta name="twitter:image" content="${SITE_URL}${escapeHtml(image)}">` : '',
        PRODUCT_TITLE: escapeHtml(title),
        PRODUCT_IMAGE: image ? `<picture class="product-picture"><source type="image/webp" srcset="${escapeHtml(image)}.400.webp 400w, ${escapeHtml(image)}.800.webp 800w" sizes="(min-width: 1132px) 1100px, calc(100vw - 32px)"><img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="eager" fetchpriority="high" decoding="async" onerror="this.parentElement.querySelector('source').remove();this.onerror=null;"></picture>` : '',
        SUMMARY: language === 'en' && meta.summary ? `<p class="summary">${escapeHtml(meta.summary)}</p>` : '',
        SPECS: renderSpecs(meta), BODY: renderMarkdown(body),
        LANGUAGE_LINKS: renderLanguageLinks(slug, available, language),
        HOME_URL: SITE_URL, HOME_LABEL: config.home, PRODUCTS_LABEL: config.products, INQUIRY_LABEL: config.inquiry, BACK_LABEL: config.back, FOOTER_NOTE: config.footer, INQUIRY_URL: `${SITE_URL}/#contact`,
        PRODUCT_JSON: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Product',
              '@id': `${canonical}#product`,
              name: title,
              description,
              url: canonical,
              mainEntityOfPage: canonical,
              ...(image ? { image: `${SITE_URL}${image}` } : {}),
              ...(meta.model ? { sku: String(meta.model).trim() } : {}),
              ...(meta.category ? { category: String(meta.category).trim() } : {}),
              brand: { '@type': 'Brand', name: 'AIZGZ Machinery' }
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: config.home, item: `${SITE_URL}/` },
                { '@type': 'ListItem', position: 2, name: config.products, item: `${SITE_URL}/#products` },
                { '@type': 'ListItem', position: 3, name: title }
              ]
            }
          ]
        }).replace(/</g, '\\u003c')
      });
      const outputDir = language === 'en'
        ? path.join(ROOT, 'products', slug)
        : path.join(ROOT, language, 'products', slug);
      await mkdir(outputDir, { recursive: true });
      await writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
      pageCount += 1;
    }
  }
  const homepagePath = path.join(ROOT, 'index.html');
  const homepage = await readFile(homepagePath, 'utf8');
  const startMarker = '<!-- PRODUCT_CARDS_START -->';
  const endMarker = '<!-- PRODUCT_CARDS_END -->';
  if (!homepage.includes(startMarker) || !homepage.includes(endMarker)) {
    throw new Error('index.html is missing the PRODUCT_CARDS markers');
  }
  const homepageCards = products.filter(({ meta }) => meta.catalog_visible !== false).map(({ meta, slug }) => renderHomepageProductCard(meta, slug)).join('\n');
  const markerPattern = /<!-- PRODUCT_CARDS_START -->[\s\S]*?<!-- PRODUCT_CARDS_END -->/;
  const homepageAlternateTags = homepageAlternates.map(({ hreflang, href }) =>
    '<link rel="alternate" hreflang="' + hreflang + '" href="' + href + '">'
  ).join('\n  ');
  const updatedHomepage = homepage
    .replace(markerPattern, `${startMarker}\n${homepageCards}\n        ${endMarker}`)
    .replace('<!-- HOMEPAGE_HREFLANG -->', homepageAlternateTags);
  await writeFile(homepagePath, updatedHomepage, 'utf8');

  const localizedHomepages = {
    es: { htmlLang: 'es', ogLocale: 'es_ES', title: 'Maquinaria industrial para construcción | AIZGZ', description: 'AIZGZ Machinery conecta compradores con proveedores de equipos de construcción, mezcla, envasado y manejo de materiales. Solicite información y cotizaciones.' },
    ar: { htmlLang: 'ar', ogLocale: 'ar_AR', title: 'معدات صناعية للبناء ومناولة المواد | AIZGZ Machinery', description: 'تربط AIZGZ Machinery المشترين الدوليين بموردي معدات البناء والخلط والتعبئة ومناولة المواد. تواصل معنا للحصول على التفاصيل وعروض الأسعار.' },
    ru: { htmlLang: 'ru', ogLocale: 'ru_RU', title: 'Оборудование для строительства и материалов | AIZGZ', description: 'AIZGZ Machinery связывает покупателей с поставщиками строительного, смесительного, упаковочного и транспортного оборудования. Запросите информацию.' }
  };
  for (const [language, config] of Object.entries(localizedHomepages)) {
    const localized = updatedHomepage
      .replace('<html lang="en" class="scroll-smooth">', `<html lang="${config.htmlLang}"${language === 'ar' ? ' dir="rtl"' : ''} class="scroll-smooth">`)
      .replace('<title>Industrial Equipment Supplier | AIZGZ Machinery</title>', `<title>${config.title}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${config.description}">`)
      .replace('<link rel="canonical" href="https://www.aizgz.com/">', `<link rel="canonical" href="${SITE_URL}/${language}/">`)
      .replace('<meta property="og:title" content="Industrial Equipment Supplier | AIZGZ Machinery">', `<meta property="og:title" content="${config.title}">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${config.description}">`)
      .replace('<meta property="og:url" content="https://www.aizgz.com/">', `<meta property="og:url" content="${SITE_URL}/${language}/">`)
      .replace('<meta property="og:locale" content="en_US">', `<meta property="og:locale" content="${config.ogLocale}">`)
      .replace('<meta name="twitter:title" content="Industrial Equipment Supplier | AIZGZ Machinery">', `<meta name="twitter:title" content="${config.title}">`)
      .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${config.description}">`);
    const outputDir = path.join(ROOT, language);
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.html'), localized, 'utf8');
  }

  // Preserve the four localized custom-machinery URLs generated by the preceding build step.
  let previousSitemap = '';
  try { previousSitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const existingCustomEntries = [...previousSitemap.matchAll(/<url>[\s\S]*?<\/url>/g)]
    .map((match) => match[0])
    .filter((entry) => /<loc>[^<]*\/custom-machinery-solutions\/<\/loc>/.test(entry));
  for (const entry of existingCustomEntries) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1] || '';
    if (loc && !sitemapEntries.some((item) => item.loc === loc)) {
      const alternates = [...entry.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)]
        .map((match) => ({ hreflang: match[1], href: match[2] }));
      sitemapEntries.push({ loc, alternates });
    }
  }

  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...sitemapEntries.map((entry) => [
      '  <url>',
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      ...entry.alternates.map((alternate) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`
      ),
      '  </url>'
    ].join('\n')),
    '</urlset>',
    ''
  ].join('\n');
  await writeFile(path.join(ROOT, 'sitemap.xml'), sitemapXml, 'utf8');
  console.log(`Generated ${pageCount} product detail pages for ${products.length} products and updated sitemap.xml.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
