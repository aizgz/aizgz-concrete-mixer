import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function extractForm(html, id, source) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)];
  const matches = forms.filter(([form]) => new RegExp('\\bid=["\\']' + id + '["\\']').test(form));
  assert.equal(matches.length, 1, source + ': expected exactly one form #' + id);
  return matches[0][0];
}

function assertHoneypot(form, source) {
  const fields = [...form.matchAll(/<input\b[^>]*>/gi)].map(([field]) => field);
  const honeypots = fields.filter((field) => /\bname=["']_gotcha["']/.test(field));
  assert.equal(honeypots.length, 1, source + ': expected exactly one _gotcha field');
  const field = honeypots[0];
  for (const [attribute, pattern] of [
    ['type', /\btype=["']text["']/],
    ['tabindex', /\btabindex=["']-1["']/],
    ['autocomplete', /\bautocomplete=["']off["']/],
    ['aria-hidden', /\baria-hidden=["']true["']/],
    ['hidden style', /\bstyle=["'][^"']*display\s*:\s*none/i]
  ]) {
    assert.match(field, pattern, source + ': _gotcha is missing ' + attribute);
  }
}

function assertRequiredFields(form, source) {
  for (const name of ['name', 'email', 'message']) {
    const field = [...form.matchAll(/<(?:input|textarea)\b[^>]*>/gi)]
      .map(([element]) => element)
      .find((element) => new RegExp('\\bname=["\\']' + name + '["\\']').test(element));
    assert.ok(field, source + ': missing field ' + name);
    assert.match(field, /\brequired(?:\s|=|>)/i, source + ': field ' + name + ' must remain required');
  }
  const email = [...form.matchAll(/<input\b[^>]*>/gi)]
    .map(([element]) => element)
    .find((element) => /\bname=["']email["']/.test(element));
  assert.match(email, /\btype=["']email["']/i, source + ': email field must retain email input type');
}

async function collectProductPages(directory) {
  const pages = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return pages;
    throw error;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await collectProductPages(fullPath));
    else if (entry.isFile() && entry.name === 'index.html') pages.push(fullPath);
  }
  return pages;
}

const homepage = await read('index.html');
const homepageForm = extractForm(homepage, 'inquiry-form', 'homepage');
assertHoneypot(homepageForm, 'homepage');
assertRequiredFields(homepageForm, 'homepage');
assert.match(homepageForm, /onsubmit=["']submitFormspree\(event\)["']/i, 'homepage: submit handler changed');
assert.match(homepage, /new FormData\(form\)/, 'homepage: FormData submission is missing');
assert.match(homepage, /method:\s*'POST'/i, 'homepage: POST submission is missing');
assert.match(homepage, /https:\/\/formspree\.io\/f\//, 'homepage: Formspree endpoint is missing');

const template = await read('templates/product.html');
const templateForm = extractForm(template, 'product-inquiry-form', 'product template');
assertHoneypot(templateForm, 'product template');
assertRequiredFields(templateForm, 'product template');
assert.match(template, /addEventListener\(['"]submit['"]/, 'product template: submit listener is missing');
assert.match(template, /new FormData\(form\)/, 'product template: FormData submission is missing');
assert.match(template, /method:\s*'POST'/i, 'product template: POST submission is missing');
assert.match(template, /https:\/\/formspree\.io\/f\//, 'product template: Formspree endpoint is missing');

const productDirectories = ['products', 'es/products', 'ar/products', 'ru/products'];
const productPages = [];
for (const directory of productDirectories) {
  productPages.push(...await collectProductPages(path.join(root, directory)));
}
assert.ok(productPages.length > 0, 'build output: no generated product detail pages found');

for (const pagePath of productPages) {
  const html = await readFile(pagePath, 'utf8');
  const relativePath = path.relative(root, pagePath);
  const form = extractForm(html, 'product-inquiry-form', relativePath);
  assertHoneypot(form, relativePath);
  assertRequiredFields(form, relativePath);
  assert.match(html, /new FormData\(form\)/, relativePath + ': FormData submission is missing');
  assert.match(html, /method:\s*'POST'/i, relativePath + ': POST submission is missing');
}

console.log('Inquiry form regression checks passed: homepage, product template, and ' + productPages.length + ' generated product page(s). No network requests were made.');
