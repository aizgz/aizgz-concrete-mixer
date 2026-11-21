const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('//') || /[\\u0000-\\u0020]/.test(raw)) return '';
  if (/^(https?:|mailto:)/i.test(raw)) return raw;
  if (/^(\/|#|\\?)/.test(raw) && !raw.startsWith('//')) return raw;
  return '';
}

function renderInline(source) {
  let text = escapeHtml(source);
  const codeToken = String.fromCharCode(96);
  const codePattern = new RegExp(codeToken + '([^' + codeToken + ']+)' + codeToken, 'g');
  text = text.replace(codePattern, '<code>$1</code>');
  text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, (match, alt, url) => {
    const safe = safeUrl(url);
    return safe ? '<img src="' + escapeHtml(safe) + '" alt="' + alt + '" loading="lazy">' : alt;
  });
  text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, (match, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return label;
    const external = /^https?:/i.test(safe);
    return '<a href="' + escapeHtml(safe) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
  });
  text = text.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  return text;
}

function isTableSeparator(line) {
  return /^\\s*\\|?\\s*:?-{3,}:?\\s*(\\|\\s*:?-{3,}:?\\s*)+\\|?\\s*$/.test(line);
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\\r\\n?/g, '\\n').split('\\n');
  const html = [];
  let paragraph = [];
  let listType = '';
  let listItems = [];
  let quote = [];

  const flushParagraph = () => {
    if (paragraph.length) html.push('<p>' + paragraph.map(renderInline).join('<br>') + '</p>');
    paragraph = [];
  };
  const flushList = () => {
    if (listItems.length) html.push('<' + listType + '>' + listItems.map((item) => '<li>' + renderInline(item) + '</li>').join('') + '</' + listType + '>');
    listType = '';
    listItems = [];
  };
  const flushQuote = () => {
    if (quote.length) html.push('<blockquote>' + quote.map((line) => '<p>' + renderInline(line) + '</p>').join('') + '</blockquote>');
    quote = [];
  };
  const flushBlocks = () => { flushParagraph(); flushList(); flushQuote(); };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^(#{1,5})\\s+(.+)$/);
    const unordered = line.match(/^\\s*[-*+]\\s+(.+)$/);
    const ordered = line.match(/^\\s*\\d+[.)]\\s+(.+)$/);
    const quoteLine = line.match(/^\\s*>\\s?(.*)$/);

    if (!line.trim()) { flushBlocks(); continue; }
    if (/^\\s*```/.test(line)) {
      flushBlocks();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      html.push('<pre><code>' + escapeHtml(code.join('\\n')) + '</code></pre>');
      continue;
    }
    if (heading) {
      flushBlocks();
      const level = Math.min(heading[1].length + 1, 6);
      html.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
      continue;
    }
    if (quoteLine) {
      flushParagraph(); flushList();
      quote.push(quoteLine[1]);
      continue;
    }
    if (unordered || ordered) {
      flushParagraph(); flushQuote();
      const type = ordered ? 'ol' : 'ul';
      if (listType && listType !== type) flushList();
      listType = type;
      listItems.push((unordered || ordered)[1]);
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      flushBlocks();
      const cells = (value) => value.trim().replace(/^\\||\\|$/g, '').split('|').map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push('<table><thead><tr>' + headers.map((cell) => '<th>' + renderInline(cell) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map((row) => '<tr>' + headers.map((_, cellIndex) => '<td>' + renderInline(row[cellIndex] || '') + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }
    if (/^\\s*(---+|\\*\\*\\*|___)\\s*$/.test(line)) {
      flushBlocks();
      html.push('<hr>');
      continue;
    }
    flushList(); flushQuote();
    paragraph.push(line.trim());
  }
  flushBlocks();
  return html.join('\\n');
}
