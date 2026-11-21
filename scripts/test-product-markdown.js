import assert from 'node:assert/strict';
import { renderMarkdown } from './product-markdown.js';

const markdown = [
  '# Product overview',
  '',
  'A **reliable** mixer with `steel` parts and [details](https://example.com/spec).',
  '',
  '## Applications',
  '',
  '- Mortar',
  '- Concrete',
  '',
  '1. Prepare materials',
  '2. Start mixing',
  '',
  '> Confirm the final configuration before production.',
  '',
  '| Model | Capacity |',
  '| --- | --- |',
  '| MX-1 | 1 m³ |',
  '',
  '```text',
  '<script>alert(1)</script>',
  '```',
  '',
  '<img src=x onerror=alert(1)>',
  '[unsafe](javascript:alert(1))'
].join('\\n');

const html = renderMarkdown(markdown);
assert.match(html, /<h2>Product overview<\\/h2>/);
assert.match(html, /<strong>reliable<\\/strong>/);
assert.match(html, /<ul>[\\s\\S]*<\\/ul>/);
assert.match(html, /<ol>[\\s\\S]*<\\/ol>/);
assert.match(html, /<blockquote>/);
assert.match(html, /<table>[\\s\\S]*<\\/table>/);
assert.match(html, /<pre><code>/);
assert.match(html, /&lt;script&gt;alert\\(1\\)&lt;\\/script&gt;/);
assert.match(html, /&lt;img src=x onerror=alert\\(1\\)&gt;/);
assert.doesNotMatch(html, /href="javascript:/i);
assert.match(html, /rel="noopener noreferrer"/);
console.log('Shared product Markdown tests passed.');
