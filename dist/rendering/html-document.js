import fs from 'node:fs/promises';
import path from 'node:path';
import { renderMarkdownDocument, renderTableOfContents, titleFromMarkdown } from '../markdown/parser.js';
const template = (body, title, config, stylesheet) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title><style>${stylesheet}</style></head>
<body class="paper-${config.paper ?? 'A4'} margin-${config.margin ?? 'normal'}">
<header class="running-header"><span>${title}</span><span>Revision notes</span></header>
<main>${body}</main>
<footer class="running-footer"><span>${title}</span><span class="page-number"></span></footer>
</body></html>`;
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character] ?? character);
}
export async function buildHtml(sourceFile, config, stylesheet) {
    const source = await fs.readFile(sourceFile, 'utf8');
    const title = config.title ?? titleFromMarkdown(source, path.basename(sourceFile, path.extname(sourceFile)));
    const rendered = renderMarkdownDocument(sourceFile, source, config.startEachFileOnNewPage ?? false);
    const toc = config.toc ? renderTableOfContents(rendered.headings) : '';
    return template(toc + rendered.body, escapeHtml(title), config, stylesheet);
}
export async function buildCombinedHtml(files, config, stylesheet) {
    const parts = [];
    const headings = [];
    let title = config.title;
    for (const [index, file] of files.entries()) {
        const source = await fs.readFile(file, 'utf8');
        if (!title)
            title = titleFromMarkdown(source, 'Revision notes');
        const rendered = renderMarkdownDocument(file, source);
        const prefix = `file-${index + 1}-`;
        let body = rendered.body
            .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
            .replace(/\bhref="#([^"]+)"/g, (_, id) => `href="#${prefix}${id}"`);
        if (index > 0 && config.startEachFileOnNewPage) {
            body = body.replace('<section class="section ', '<section class="section page-break-before ');
        }
        headings.push(...rendered.headings.map((heading) => ({ ...heading, id: prefix + heading.id })));
        parts.push(body);
    }
    const toc = config.toc ? renderTableOfContents(headings) : '';
    return template(toc + parts.join('\n'), escapeHtml(title ?? 'Revision notes'), config, stylesheet);
}
