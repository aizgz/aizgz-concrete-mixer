import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'content', 'products');
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'product.html');
const EQUIPMENT_TEMPLATE_PATH = path.join(ROOT, 'templates', 'equipment.html');
const TAXONOMY_PATH = path.join(ROOT, 'content', 'equipment-categories.json');
const SITE_URL = 'https://www.aizgz.com';
const LANGUAGES = {
  en: { htmlLang: 'en', ogLocale: 'en_US', dir: 'ltr', label: 'English', home: 'Home', products: 'Products', inquiry: 'Request a quotation', back: 'Back to product catalogue', footer: 'Product information and configuration are subject to confirmation.', titleKey: 'title', bodyKey: null },
  es: { htmlLang: 'es', ogLocale: 'es_ES', dir: 'ltr', label: 'Español', home: 'Inicio', products: 'Productos', inquiry: 'Solicitar presupuesto', back: 'Volver al catálogo de productos', footer: 'La información y configuración del producto están sujetas a confirmación.', titleKey: 'title_es', bodyKey: 'body_es' },
  ar: { htmlLang: 'ar', ogLocale: 'ar_AR', dir: 'rtl', label: 'العربية', home: 'الرئيسية', products: 'المنتجات', inquiry: 'طلب عرض سعر', back: 'العودة إلى كتالوج المنتجات', footer: 'تخضع معلومات المنتج وتكوينه للتأكيد.', titleKey: 'title_ar', bodyKey: 'body_ar' },
  ru: { htmlLang: 'ru', ogLocale: 'ru_RU', dir: 'ltr', label: 'Русский', home: 'Главная', products: 'Продукция', inquiry: 'Запросить предложение', back: 'Вернуться в каталог продукции', footer: 'Информация о продукте и его конфигурация подлежат подтверждению.', titleKey: 'title_ru', bodyKey: 'body_ru' }
};
const EQUIPMENT_PAGE_TEXT = {
  en: { eyebrow: 'AIZGZ EQUIPMENT CATALOGUE', title: 'Equipment for Powder Processing & Dry-Mix Mortar Production', description: 'Explore equipment for mixing, conveying, feeding and packaging dry-mix mortar and powder materials. Product configurations can be reviewed according to your requirements.', ctaTitle: 'Need help selecting equipment?', ctaDescription: 'Tell us about your materials and production requirements. AIZGZ can coordinate with relevant manufacturers to review suitable equipment options and technical proposals.', ctaLabel: 'Contact AIZGZ', details: 'View Details', quote: 'Request a Quote', footer: 'AIZGZ Machinery coordinates equipment selection and communication with relevant manufacturers. Specifications and configurations are subject to confirmation.' },
  es: { eyebrow: 'CATÁLOGO DE EQUIPOS AIZGZ', title: 'Equipos para el procesamiento de polvos y la producción de mortero seco', description: 'Explore equipos para mezclar, transportar, alimentar y envasar mortero seco y materiales en polvo. Las configuraciones se revisan según sus requisitos.', ctaTitle: '¿Necesita ayuda para seleccionar equipos?', ctaDescription: 'Comparta información sobre sus materiales y requisitos de producción. AIZGZ puede coordinar con fabricantes relevantes la revisión de equipos y propuestas técnicas.', ctaLabel: 'Contactar con AIZGZ', details: 'Ver detalles', quote: 'Solicitar presupuesto', footer: 'AIZGZ Machinery coordina la selección de equipos y la comunicación con fabricantes relevantes. Las especificaciones y configuraciones están sujetas a confirmación.' },
  ar: { eyebrow: 'كتالوج معدات AIZGZ', title: 'معدات معالجة المساحيق وإنتاج الملاط الجاف', description: 'استكشف معدات الخلط والنقل والتغذية والتعبئة للملاط الجاف والمواد المسحوقة. تتم مراجعة تكوينات المعدات وفقاً لمتطلباتك.', ctaTitle: 'هل تحتاج إلى مساعدة في اختيار المعدات؟', ctaDescription: 'أخبرنا عن المواد ومتطلبات الإنتاج لديك. يمكن لـ AIZGZ التنسيق مع الشركات المصنعة المعنية لمراجعة خيارات المعدات والمقترحات الفنية المناسبة.', ctaLabel: 'تواصل مع AIZGZ', details: 'عرض التفاصيل', quote: 'طلب عرض سعر', footer: 'تنسق AIZGZ Machinery اختيار المعدات والتواصل مع الشركات المصنعة المعنية. تخضع المواصفات والتكوينات للتأكيد.' },
  ru: { eyebrow: 'КАТАЛОГ ОБОРУДОВАНИЯ AIZGZ', title: 'Оборудование для переработки порошков и производства сухих строительных смесей', description: 'Ознакомьтесь с оборудованием для смешивания, транспортировки, подачи и упаковки сухих смесей и порошковых материалов. Конфигурации подбираются с учётом ваших требований.', ctaTitle: 'Нужна помощь с выбором оборудования?', ctaDescription: 'Расскажите о материалах и производственных требованиях. AIZGZ может согласовать с соответствующими производителями подбор оборудования и технические предложения.', ctaLabel: 'Связаться с AIZGZ', details: 'Подробнее', quote: 'Запросить предложение', footer: 'AIZGZ Machinery координирует подбор оборудования и взаимодействие с соответствующими производителями. Характеристики и конфигурации подлежат подтверждению.' }
};
const PRODUCT_PAGE_TEXT = {
  en: { equipment:'Equipment', overview:'Product Overview', applications:'Applications', features:'Main Features', specs:'Technical Specifications', configuration:'Configuration Options', customization:'Customization Options', customizationText:'Equipment specifications and configurations can be discussed according to your production requirements. AIZGZ coordinates with relevant manufacturers to review your requirements and arrange equipment drawings or technical proposals for your confirmation before manufacturing.', inquiry:'Request a Quote', inquiryIntro:'Share your application, material and capacity requirements. AIZGZ will review your needs and coordinate with relevant manufacturers.', product:'Equipment Name', application:'Application', material:'Material to Be Processed', capacity:'Required Capacity (optional)', requirements:'Additional Requirements', name:'Your Name', email:'Email Address', submit:'Send Inquiry', note:'Please do not include passwords or payment card details.', footer:'AIZGZ coordinates equipment selection and communication with relevant manufacturers. Specifications and configurations are subject to confirmation.' },
  es: { equipment:'Equipos', overview:'Descripción del equipo', applications:'Aplicaciones', features:'Características principales', specs:'Especificaciones técnicas', configuration:'Opciones de configuración', customization:'Opciones de personalización', customizationText:'Las especificaciones y configuraciones del equipo pueden analizarse según sus requisitos de producción. AIZGZ coordina con los fabricantes pertinentes la revisión de sus requisitos y la preparación de planos o propuestas técnicas para su aprobación antes de la fabricación.', inquiry:'Solicitar presupuesto', inquiryIntro:'Comparta su aplicación, materiales y requisitos de capacidad. AIZGZ revisará sus necesidades y coordinará con los fabricantes pertinentes.', product:'Equipo', application:'Aplicación', material:'Material que se procesará', capacity:'Capacidad requerida (opcional)', requirements:'Requisitos adicionales', name:'Su nombre', email:'Correo electrónico', submit:'Enviar consulta', note:'No incluya contraseñas ni datos de tarjetas de pago.', footer:'AIZGZ coordina la selección de equipos y la comunicación con fabricantes pertinentes. Las especificaciones y configuraciones están sujetas a confirmación.' },
  ar: { equipment:'المعدات', overview:'نظرة عامة على المعدات', applications:'التطبيقات', features:'الميزات الرئيسية', specs:'المواصفات الفنية', configuration:'خيارات التكوين', customization:'خيارات التخصيص', customizationText:'يمكن مناقشة مواصفات المعدات وتكويناتها وفقاً لمتطلبات الإنتاج لديك. تنسق AIZGZ مع الشركات المصنعة المعنية لمراجعة متطلباتك وترتيب الرسومات أو المقترحات الفنية لاعتمادك قبل التصنيع.', inquiry:'طلب عرض سعر', inquiryIntro:'شاركنا الاستخدام والمواد ومتطلبات السعة. ستراجع AIZGZ احتياجاتك وتنسق مع الشركات المصنعة المعنية.', product:'المعدة', application:'الاستخدام', material:'المادة المراد معالجتها', capacity:'السعة المطلوبة (اختياري)', requirements:'متطلبات إضافية', name:'الاسم', email:'البريد الإلكتروني', submit:'إرسال الاستفسار', note:'يرجى عدم إدخال كلمات المرور أو بيانات بطاقات الدفع.', footer:'تنسق AIZGZ اختيار المعدات والتواصل مع الشركات المصنعة المعنية. تخضع المواصفات والتكوينات للتأكيد.' },
  ru: { equipment:'Оборудование', overview:'Обзор оборудования', applications:'Применение', features:'Основные особенности', specs:'Технические характеристики', configuration:'Варианты комплектации', customization:'Варианты индивидуальной настройки', customizationText:'Характеристики и комплектация оборудования могут обсуждаться с учётом ваших производственных требований. AIZGZ координирует с соответствующими производителями рассмотрение требований и подготовку чертежей или технических предложений для вашего согласования до начала производства.', inquiry:'Запросить предложение', inquiryIntro:'Укажите область применения, материал и требуемую производительность. AIZGZ рассмотрит ваши требования и согласует их с соответствующими производителями.', product:'Оборудование', application:'Применение', material:'Обрабатываемый материал', capacity:'Требуемая производительность (необязательно)', requirements:'Дополнительные требования', name:'Ваше имя', email:'Электронная почта', submit:'Отправить запрос', note:'Не указывайте пароли и данные банковских карт.', footer:'AIZGZ координирует подбор оборудования и взаимодействие с соответствующими производителями. Характеристики и конфигурации подлежат подтверждению.' }
};
const SPEC_FIELDS = [
  ['model', 'Model'], ['category', 'Equipment Category'], ['capacity', 'Capacity / Throughput'],
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
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 6);
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
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
function renderHomepageProductCard(meta, slug, category) {
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
  const categoryText = category.status === 'provisional' ? 'Category under review' : category.label;
  const categoryLabel = `<p class="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(categoryText)}</p>`;
  return [
    '<article class="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-100 bg-white shadow-md transition duration-300 hover:shadow-xl">',
    `<a href="/products/${slug}/" class="block flex-1 text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700">`,
    `<div class="relative h-48 overflow-hidden bg-slate-100">${imageHtml}</div>`,
    `<div class="p-6"><h3 class="text-xl font-bold text-slate-800">${title}</h3>${categoryLabel}${model}${capacity}${internalCapacity}</div>`,
    '</a>',
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 p-6 pt-4">',
    `<a href="/products/${slug}/" class="rounded bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900" aria-label="Details: ${title}">Details</a>`,
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
function renderPrimaryNav(language, currentPage) {
  const config = LANGUAGES[language];
  const equipmentUrl = language === 'en' ? '/equipment/' : `/${language}/equipment/`;
  const links = [
    { label: config.home, href: `${SITE_URL}/`, key: 'home' },
    { label: config.products, href: `${SITE_URL}${equipmentUrl}`, key: 'equipment' },
    { label: config.inquiry, href: currentPage === 'product' ? '#inquiry' : `${SITE_URL}/#contact`, key: 'inquiry' }
  ];
  return `<nav class="primary-nav" aria-label="Main navigation">${links.map((link) => {
    const active = link.key === currentPage ? ' aria-current="page"' : '';
    const className = link.key === 'inquiry' ? ' class="nav-inquiry"' : '';
    return `<a href="${link.href}"${active}${className}>${escapeHtml(link.label)}</a>`;
  }).join('')}</nav>`;
}
function renderEquipmentCard(product, language, category) {
  const config = LANGUAGES[language];
  const text = EQUIPMENT_PAGE_TEXT[language];
  const meta = product.meta;
  const title = String(meta[config.titleKey] || meta.title || '').trim();
  const body = language === 'en' ? product.englishBody : String(meta[config.bodyKey] || product.englishBody).trim();
  const summary = makeDescription(meta, body, language);
  const image = safeImagePath(meta.image);
  const detailPath = language !== 'en' && String(meta[config.titleKey] || '').trim() && String(meta[config.bodyKey] || '').trim()
    ? `/${language}/products/${product.slug}/`
    : `/products/${product.slug}/`;
  const imageHtml = image ? `<a class="equipment-image" href="${detailPath}"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async"></a>` : '';
  return `<article class="equipment-card">${imageHtml}<div class="card-body"><span class="category-label">${escapeHtml(category.label)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(summary)}</p><div class="card-actions"><a class="details-link" href="${detailPath}">${escapeHtml(text.details)}</a><a class="quote-link" href="${detailPath}#inquiry">${escapeHtml(text.quote)}</a></div></div></article>`;
}
function renderEquipmentCategorySection(category, products, language) {
  const label = category[`label_${language}`] || category.label;
  const description = category[`description_${language}`] || category.description;
  const cards = products.filter((product) => product.category.id === category.id && product.category.status !== 'provisional')
    .map((product) => renderEquipmentCard(product, language, { ...category, label })).join('');
  if (!cards) return '';
  return `<section class="catalog-section" id="${escapeHtml(category.id)}"><div class="section-heading"><div><h2>${escapeHtml(label)}</h2><p>${escapeHtml(description)}</p></div></div><div class="product-grid">${cards}</div></section>`;
}
function renderProvisionalSection(products, language) {
  const labels = {
    en: { title: 'Equipment Under Review', description: 'These listings are being reviewed to confirm the exact equipment scope and category.', status: 'Classification under review' },
    es: { title: 'Equipos en revisión', description: 'Estamos revisando estos productos para confirmar el tipo exacto de equipo y su categoría.', status: 'Clasificación en revisión' },
    ar: { title: 'معدات قيد المراجعة', description: 'تتم مراجعة هذه العناصر لتأكيد نوع المعدات ونطاقها وفئتها بدقة.', status: 'التصنيف قيد المراجعة' },
    ru: { title: 'Оборудование на проверке', description: 'Проверяем точный состав оборудования и его категорию для этих позиций.', status: 'Категория уточняется' }
  }[language];
  const pending = products.filter((product) => product.category.status === 'provisional');
  if (!pending.length) return '';
  const cards = pending.map((product) => renderEquipmentCard(product, language, { label: labels.status })).join('');
  return `<section class="catalog-section provisional-section"><div class="section-heading"><div><h2>${escapeHtml(labels.title)}</h2><p>${escapeHtml(labels.description)}</p></div></div><div class="product-grid">${cards}</div></section>`;
}
function renderEquipmentSolution(solution, products, language) {
  const product = products.find((item) => item.category.id === solution.id);
  if (!product) return '';
  const config = LANGUAGES[language];
  const title = String(product.meta[config.titleKey] || product.meta.title || '').trim();
  const description = solution[`description_${language}`] || solution.description;
  const detailPath = language !== 'en' && String(product.meta[config.titleKey] || '').trim() && String(product.meta[config.bodyKey] || '').trim()
    ? `/${language}/products/${product.slug}/`
    : `/products/${product.slug}/`;
  return `<section class="solution-section"><h2>${escapeHtml(solution[`label_${language}`] || solution.label)}</h2><p>${escapeHtml(description)}</p><a class="solution-link" href="${detailPath}">${escapeHtml(title)} — ${escapeHtml(EQUIPMENT_PAGE_TEXT[language].details)}</a></section>`;
}
function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '');
}

async function main() {
  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const equipmentTemplate = await readFile(EQUIPMENT_TEMPLATE_PATH, 'utf8');
  const taxonomy = JSON.parse(await readFile(TAXONOMY_PATH, 'utf8'));
  const collectionById = new Map([...taxonomy.categories, ...taxonomy.solutions].map((item) => [item.id, item]));
  const categoryFor = (meta, slug) => {
    const collection = collectionById.get(String(meta.equipment_category || '').trim());
    if (!collection) throw new Error(`Missing or invalid equipment_category for ${slug}`);
    return { ...collection, status: meta.equipment_category_status || 'confirmed' };
  };
  const files = (await readdir(PRODUCTS_DIR)).filter((name) => name.toLowerCase().endsWith('.md')).sort();
  const products = [];
  const seenSlugs = new Set();
  for (const filename of files) {
    const source = await readFile(path.join(PRODUCTS_DIR, filename), 'utf8');
    const { data: meta, body: englishBody } = parseFrontMatter(source, filename);
    const slug = String(meta.url_slug || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filename}: invalid or missing url_slug "${slug}"`);
    if (seenSlugs.has(slug)) throw new Error(`Duplicate product url_slug: ${slug}`);
    seenSlugs.add(slug);
    if (!String(meta.title || '').trim() || !englishBody.trim()) throw new Error(`${filename}: English title and body are required`);
    const category = categoryFor(meta, slug);
    products.push({ meta, slug, englishBody, category });
  }

  let pageCount = 0;
  const sitemapEntries = [{ loc: `${SITE_URL}/`, alternates: [] }];
  for (const { meta, slug, englishBody, category } of products) {
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
        SUMMARY: `<p class="summary">${escapeHtml(makeDescription(meta, body, language))}</p>`,
        CATEGORY_LABEL: escapeHtml(category[`label_${language}`] || category.label),
        EQUIPMENT_URL: `${SITE_URL}${language === 'en' ? '/equipment/' : `/${language}/equipment/`}`,
        EQUIPMENT_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].equipment),
        OVERVIEW_TITLE: escapeHtml(PRODUCT_PAGE_TEXT[language].overview),
        APPLICATIONS_SECTION: meta.application ? `<section class="detail-section"><h2>${escapeHtml(PRODUCT_PAGE_TEXT[language].applications)}</h2><div class="content">${renderMarkdown(String(meta.application))}</div></section>` : '',
        FEATURES_SECTION: meta.features ? `<section class="detail-section"><h2>${escapeHtml(PRODUCT_PAGE_TEXT[language].features)}</h2><div class="content">${renderMarkdown(String(meta.features))}</div></section>` : '',
        SPECS_TITLE: escapeHtml(PRODUCT_PAGE_TEXT[language].specs),
        SPECS: renderSpecs({ ...meta, category: category[`label_${language}`] || category.label }),
        CONFIGURATION_SECTION: meta.optional_components ? `<section class="detail-section"><h2>${escapeHtml(PRODUCT_PAGE_TEXT[language].configuration)}</h2><div class="content">${renderMarkdown(String(meta.optional_components))}</div></section>` : '',
        CUSTOMIZATION_TITLE: escapeHtml(PRODUCT_PAGE_TEXT[language].customization),
        CUSTOMIZATION_TEXT: escapeHtml(PRODUCT_PAGE_TEXT[language].customizationText),
        INQUIRY_SECTION_TITLE: escapeHtml(PRODUCT_PAGE_TEXT[language].inquiry),
        INQUIRY_INTRO: escapeHtml(PRODUCT_PAGE_TEXT[language].inquiryIntro),
        FORM_PRODUCT_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].product),
        FORM_APPLICATION_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].application),
        FORM_MATERIAL_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].material),
        FORM_CAPACITY_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].capacity),
        FORM_REQUIREMENTS_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].requirements),
        FORM_NAME_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].name),
        FORM_EMAIL_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].email),
        FORM_SUBMIT_LABEL: escapeHtml(PRODUCT_PAGE_TEXT[language].submit),
        FORM_NOTE: escapeHtml(PRODUCT_PAGE_TEXT[language].note),
        FOOTER_NOTE: escapeHtml(PRODUCT_PAGE_TEXT[language].footer),
        BODY: renderMarkdown(body),
        LANGUAGE_LINKS: renderLanguageLinks(slug, available, language),
        PRIMARY_NAV: renderPrimaryNav(language, 'product'),
        HOME_URL: SITE_URL, HOME_LABEL: config.home, PRODUCTS_LABEL: config.products, INQUIRY_LABEL: config.inquiry, BACK_LABEL: config.back, FOOTER_NOTE: config.footer, INQUIRY_URL: `${SITE_URL}/#contact`,
        PRODUCT_JSON: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Product', name: title,
          description, url: canonical, mainEntityOfPage: canonical,
          ...(image ? { image: `${SITE_URL}${image}` } : {}),
          ...(meta.model ? { sku: String(meta.model).trim() } : {}),
          category: category.label,
          brand: { '@type': 'Brand', name: 'AIZGZ Machinery' }
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
  const homepageCards = products.map(({ meta, slug, category }) => renderHomepageProductCard(meta, slug, category)).join('\n');
  const markerPattern = /<!-- PRODUCT_CARDS_START -->[\s\S]*?<!-- PRODUCT_CARDS_END -->/;
  await writeFile(homepagePath, homepage.replace(markerPattern, `${startMarker}\n${homepageCards}\n        ${endMarker}`), 'utf8');

  for (const language of Object.keys(LANGUAGES)) {
    const config = LANGUAGES[language];
    const text = EQUIPMENT_PAGE_TEXT[language];
    const route = language === 'en' ? '/equipment/' : `/${language}/equipment/`;
    const canonical = `${SITE_URL}${route}`;
    const alternates = Object.keys(LANGUAGES).map((code) => {
      const href = code === 'en' ? '/equipment/' : `/${code}/equipment/`;
      return `<link rel="alternate" hreflang="${LANGUAGES[code].htmlLang}" href="${SITE_URL}${href}">`;
    });
    alternates.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/equipment/">`);
    const categoryNav = taxonomy.categories.map((category) =>
      `<a href="#${escapeHtml(category.id)}">${escapeHtml(category[`label_${language}`] || category.label)}</a>`
    ).join('');
    const categorySections = taxonomy.categories.map((category) =>
      renderEquipmentCategorySection(category, products, language)
    ).join('');
    const provisionalSection = renderProvisionalSection(products, language);
    const solutionSection = taxonomy.solutions.map((solution) =>
      renderEquipmentSolution(solution, products, language)
    ).join('');
    const languageLinks = Object.keys(LANGUAGES).map((code) => {
      const href = code === 'en' ? '/equipment/' : `/${code}/equipment/`;
      const active = code === language ? ' aria-current="page"' : '';
      return `<a href="${href}"${active}>${LANGUAGES[code].label}</a>`;
    }).join('');
    const description = text.description.length > 160 ? `${text.description.slice(0,157).trimEnd()}...` : text.description;
    const html = fillTemplate(equipmentTemplate, {
      HTML_LANG: config.htmlLang, DIR: config.dir,
      TITLE: escapeHtml(`${text.title} | AIZGZ Machinery`),
      DESCRIPTION: escapeHtml(description), CANONICAL: canonical,
      ALTERNATES: alternates.join('\n  '), HOME_URL: SITE_URL,
      EYEBROW: escapeHtml(text.eyebrow), HERO_TITLE: escapeHtml(text.title),
      HERO_DESCRIPTION: escapeHtml(text.description), CATEGORY_NAV: categoryNav,
      CATEGORY_SECTIONS: categorySections, PROVISIONAL_SECTION: provisionalSection, SOLUTION_SECTION: solutionSection,
      LANGUAGE_LINKS: languageLinks, PRIMARY_NAV: renderPrimaryNav(language, 'equipment'), CTA_TITLE: escapeHtml(text.ctaTitle),
      CTA_DESCRIPTION: escapeHtml(text.ctaDescription), CTA_LABEL: escapeHtml(text.ctaLabel),
      CTA_URL: `${SITE_URL}/#contact`, FOOTER: escapeHtml(text.footer)
    });
    const outputDir = language === 'en'
      ? path.join(ROOT, 'equipment')
      : path.join(ROOT, language, 'equipment');
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
    const sitemapAlternates = Object.keys(LANGUAGES).map((code) => ({
      hreflang: LANGUAGES[code].htmlLang,
      href: `${SITE_URL}${code === 'en' ? '/equipment/' : `/${code}/equipment/`}`
    }));
    sitemapAlternates.push({ hreflang: 'x-default', href: `${SITE_URL}/equipment/` });
    sitemapEntries.push({ loc: canonical, alternates: sitemapAlternates });
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
