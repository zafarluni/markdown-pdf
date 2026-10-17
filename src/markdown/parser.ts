import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/common';

export type DocumentHeading = { level: number; id: string; text: string };
export type RenderedMarkdown = { body: string; headings: DocumentHeading[] };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character);
}

function resolveAsset(sourceFile: string, src: string): string {
  if (/^https?:/i.test(src) || /^data:image\//i.test(src)) return src;
  if (/^[a-z][a-z\d+.-]*:/i.test(src)) return '';
  const absolute = path.resolve(path.dirname(sourceFile), src);
  if (!fs.existsSync(absolute)) return src;
  const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' } as Record<string, string>)[path.extname(absolute).toLowerCase()];
  return mime ? `data:${mime};base64,${fs.readFileSync(absolute).toString('base64')}` : src;
}

function headingId(text: string): string {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
}

export function createMarkdownParser(sourceFile: string): MarkdownIt {
  // LLM Markdown is data, so raw HTML stays escaped. Supported components are
  // added through Markdown plugins instead of executing arbitrary HTML.
  const parser = new MarkdownIt({
    html: false, linkify: true, typographer: true,
    highlight(code, language) {
      const content = language && hljs.getLanguage(language)
        ? hljs.highlight(code, { language, ignoreIllegals: true }).value
        : escapeHtml(code);
      return `<pre class="hljs"><code>${content}</code></pre>`;
    }
  });
  parser.use(footnote).use(taskLists, { enabled: false });
  parser.renderer.rules.image = (tokens: Token[], index: number) => {
    const token = tokens[index];
    token.attrSet('src', resolveAsset(sourceFile, token.attrGet('src') ?? ''));
    token.attrSet('loading', 'eager');
    return parser.renderer.renderToken(tokens, index, {});
  };
  return parser;
}

export function renderMarkdownDocument(sourceFile: string, source: string, pageBreakBefore = false): RenderedMarkdown {
  const parser = createMarkdownParser(sourceFile);
  const env = {};
  const tokens = parser.parse(source.replace(/^\uFEFF/, ''), env);
  const headings: DocumentHeading[] = [];
  const seen = new Map<string, number>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'heading_open' || token.level !== 0) continue;
    const inline = tokens[index + 1];
    const content = inline?.children?.map((child) => {
      if (child.type === 'text' || child.type === 'code_inline' || child.type === 'image') return child.content;
      if (child.type === 'softbreak' || child.type === 'hardbreak') return ' ';
      return '';
    }).join('') || inline?.content || '';
    const base = headingId(content);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    token.attrSet('id', id);
    headings.push({ level: Number(token.tag.slice(1)), id, text: content });
  }

  const sections: Token[][] = [];
  let current: Token[] = [];
  for (const token of tokens) {
    if ((token.type === 'heading_open' && token.level === 0) || token.type === 'footnote_block_open') {
      if (current.length) sections.push(current);
      current = [];
    }
    current.push(token);
  }
  if (current.length) sections.push(current);

  const body = sections.map((part, index) => {
    const level = part[0]?.type === 'heading_open' ? Number(part[0].tag.slice(1)) : 0;
    const classes = ['section', `section-level-${level}`];
    if (pageBreakBefore && index === 0) classes.push('page-break-before');
    if (part[0]?.type === 'footnote_block_open') classes.push('footnote-section');
    const textLength = part.reduce((sum, token) => sum + token.content.length, 0);
    const itemCount = part.filter((token) => token.type === 'tr_open' || token.type === 'list_item_open').length;
    const hasLargeBlock = part.some((token) => token.type === 'fence'
      || token.type === 'image' || token.children?.some((child) => child.type === 'image'));
    if (level > 0 && textLength <= 650 && itemCount <= 5 && !hasLargeBlock) classes.push('section-short');
    const lead = part[0]?.type === 'heading_open'
      && part[3]?.type === 'paragraph_open'
      && part[4]?.type === 'inline'
      && part[5]?.type === 'paragraph_close'
      && part[4].content.length <= 500
      && !part[4].children?.some((child) => child.type === 'image');
    const contents = lead
      ? `<div class="heading-lead">${parser.renderer.render(part.slice(0, 6), parser.options, env)}</div>${parser.renderer.render(part.slice(6), parser.options, env)}`
      : parser.renderer.render(part, parser.options, env);
    return `<section class="${classes.join(' ')}">${contents}</section>`;
  }).join('\n');
  return { body, headings };
}

export function renderTableOfContents(headings: DocumentHeading[]): string {
  const entries = headings.filter((heading) => heading.level <= 3);
  if (entries.length < 2) return '';
  return `<nav class="table-of-contents" aria-label="Contents"><h2>Contents</h2><ol>${entries.map((heading) =>
    `<li class="toc-level-${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`
  ).join('')}</ol></nav>`;
}

export function titleFromMarkdown(source: string, fallback: string): string {
  const match = source.match(/^#\s+(.+?)\s*#*\s*$/m);
  return match?.[1] ?? fallback;
}
