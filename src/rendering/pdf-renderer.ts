import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import type { PdfConfig } from '../config/types.js';

const require = createRequire(import.meta.url);

export async function writePdf(html: string, output: string, config: PdfConfig): Promise<void> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Executable doesn't exist")) throw error;
    // A system browser is enough for users who have not downloaded Playwright's copy.
    try {
      browser = await chromium.launch({ headless: true, channel: 'chrome' });
    } catch {
      browser = await chromium.launch({ headless: true, channel: 'msedge' });
    }
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.addScriptTag({ path: require.resolve('katex/dist/katex.min.js') });
    await page.addScriptTag({ path: require.resolve('katex/dist/contrib/auto-render.min.js') });
    await page.evaluate(() => {
      const render = (window as Window & { renderMathInElement?: (root: Element, options: object) => void }).renderMathInElement;
      if (!render) throw new Error('KaTeX did not load');
      render(document.querySelector('main')!, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    });
    await page.evaluate(() => document.fonts.ready);
    const missing = await page.evaluate(async () => {
      const images = [...document.images];
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      return images.filter((image) => !image.naturalWidth).map((image) => image.getAttribute('src'));
    });
    if (missing.length) throw new Error(`Could not load image: ${missing[0]}`);
    await fs.mkdir(path.dirname(output), { recursive: true });
    const margin = config.margin === 'narrow' ? '11mm' : config.margin === 'wide' ? '23mm' : '16mm';
    await page.pdf({
      path: output,
      format: config.paper ?? 'A4',
      printBackground: true,
      outline: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font: 8px Arial; color: #68738a; width: 100%; text-align: right"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '18mm', right: margin, bottom: '18mm', left: margin }
    });
  } finally {
    await browser.close();
  }
}
