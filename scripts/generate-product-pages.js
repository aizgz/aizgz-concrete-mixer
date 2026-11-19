import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'content', 'products');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'product.html');
const SITE_URL = 'https://aizgz.vercel.app';
const LANGUAGES = {
  en: { htmlLang: 'en', dir: 'ltr', label: 'English', titleKey: 'title', bodyKey: null },
  es: { htmlLang: 'es', dir: 'ltr', label: 'Español', titleKey: 'title_es', bodyKey: 'body_es' },
  ar: { htmlLang: 'ar', dir: 'rtl', label: 'العربية', titleKey: 'title_ar', bodyKey: 'body_ar' },
  ru: { htmlLang: 'ru', dir: 'ltr', label: 'Русский', titleKey: 'title_ru', bodyKey: 'body_ru' }
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
  if (!match) throw new Error(\`\${filename}: missing YAML front matter\`);
  const lines = match[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const field = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!field) throw new Error(\`\${filename}:\${i + 1}: unsupported front matter syntax\`);
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
    if (!raw && i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
      const continuation = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        i += 1;
        continuation.push(lines[i].trim());
      }
      data[key] = continuation.join(' ');
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
  const flushParagraph = () => {
    if (paragraph.length) output.push(\`<p>\${paragraph.map(renderInline).join('<br>')}</p>\`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(\`<ul>\${list.map((item) => \`<li>\${renderInline(item)}</li>\`).join('')}</ul>\`);
    list = [];
  };
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 6);
      output.push(\`<h\${level}>\${renderInline(heading[2])}</h\${level}>\`);
    } else if (item) {
      flushParagraph(); list.push(item[1]);
    } else {
      flushList(); paragraph.push(line.trim());
    }
  }
  flushParagraph(); flushList();
  return output.join('\n');
}
function plainText(markdown) {
  return String(markdown || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function makeDescription(meta, body) {
  const source = meta.summary || plainText(body);
  return source ? (source.length > 160 ? \`\${source.slice(0, 157).trimEnd()}...\` : source)
    : 'Product details, specifications and configuration options from AIZGZ Machinery.';
}
function renderSpecs(meta) {
  return SPEC_FIELDS.filter(([key]) => meta[key] !== undefined && meta[key] !== null && String(meta[key]).trim())
    .map(([key, label]) => \`<div class="spec"><dt>\${escapeHtml(label)}</dt><dd>\${escapeHtml(meta[key])}</dd></div>\`).join('\n');
}
function renderLanguageLinks(slug, available, current) {
  return available.map((language) => {
    const href = language === 'en' ? \`/products/\${slug}/\` : \`/\${language}/products/\${slug}/\`;
    const active = language === current ? ' aria-current="page"' : '';
    return \`<a href="\${href}"\${active}>\${LANGUAGES[language].label}</a>\`;
  }).join('\n');
}
function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '');
}

async function main() {
  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const files = (await readdir(PRODUCTS_DIR)).filter((name) => name.toLowerCase().endsWith('.md')).sort();
  const products = [];
  const seenSlugs = new Set();
  for (const filename of files) {
    const source = await readFile(path.join(PRODUCTS_DIR, filename), 'utf8');
    const { data: meta, body: englishBody } = parseFrontMatter(source, filename);
    const slug = String(meta.url_slug || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(\`\${filename}: invalid or missing url_slug "\${slug}"\`);
    if (seenSlugs.has(slug)) throw new Error(\`Duplicate product url_slug: \${slug}\`);
    seenSlugs.add(slug);
    if (!String(meta.title || '').trim() || !englishBody.trim()) throw new Error(\`\${filename}: English title and body are required\`);
    products.push({ meta, slug, englishBody });
  }

  let pageCount = 0;
  for (const { meta, slug, englishBody } of products) {
    const available = ['en', ...['es', 'ar', 'ru'].filter((language) =>
      String(meta[LANGUAGES[language].titleKey] || '').trim() &&
      String(meta[LANGUAGES[language].bodyKey] || '').trim()
    )];
    for (const language of available) {
      const config = LANGUAGES[language];
      const title = String(meta[config.titleKey] || '').trim();
      const body = language === 'en' ? englishBody : String(meta[config.bodyKey]).trim();
      const route = language === 'en' ? \`/products/\${slug}/\` : \`/\${language}/products/\${slug}/\`;
      const canonical = \`\${SITE_URL}\${route}\`;
      const description = makeDescription(meta, body);
      const image = safeImagePath(meta.image);
      const alternates = available.map((code) => {
        const href = code === 'en' ? \`/products/\${slug}/\` : \`/\${code}/products/\${slug}/\`;
        return \`<link rel="alternate" hreflang="\${LANGUAGES[code].htmlLang}" href="\${SITE_URL}\${href}">\`;
      });
      alternates.push(\`<link rel="alternate" hreflang="x-default" href="\${SITE_URL}/products/\${slug}/">\`);
      const html = fillTemplate(template, {
        HTML_LANG: config.htmlLang, DIR: config.dir,
        TITLE: escapeHtml(\`\${title} | AIZGZ Machinery\`),
        DESCRIPTION: escapeHtml(description), CANONICAL: canonical,
        ALTERNATES: alternates.join('\n  '), OG_TITLE: escapeHtml(title),
        OG_DESCRIPTION: escapeHtml(description), OG_URL: canonical,
        OG_IMAGE: image ? \`<meta property="og:image" content="\${SITE_URL}\${escapeHtml(image)}">\` : '',
        PRODUCT_TITLE: escapeHtml(title),
        PRODUCT_IMAGE: image ? \`<img class="product-image" src="\${escapeHtml(image)}" alt="\${escapeHtml(title)}" loading="eager" fetchpriority="high">\` : '',
        SUMMARY: meta.summary ? \`<p class="summary">\${escapeHtml(meta.summary)}</p>\` : '',
        SPECS: renderSpecs(meta), BODY: renderMarkdown(body),
        LANGUAGE_LINKS: renderLanguageLinks(slug, available, language),
        HOME_URL: SITE_URL, INQUIRY_URL: \`\${SITE_URL}/#contact\`,
        PRODUCT_JSON: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'WebPage', name: title,
          description, url: canonical, inLanguage: config.htmlLang,
          isPartOf: { '@type': 'WebSite', name: 'AIZGZ Machinery', url: \`\${SITE_URL}/\` }
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
  console.log(\`Generated \${pageCount} product detail pages for \${products.length} products.\`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
