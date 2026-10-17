import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function loadKatexCss(): Promise<string> {
  const cssPath = require.resolve('katex/dist/katex.min.css');
  const directory = path.dirname(cssPath);
  const css = await fs.readFile(cssPath, 'utf8');
  const references = [...new Set([...css.matchAll(/url\((?:["']?)(fonts\/[^)'"\s]+)(?:["']?)\)/g)].map((match) => match[1]))];
  let embedded = css;
  for (const reference of references) {
    const extension = path.extname(reference).slice(1);
    const mime = extension === 'woff2' ? 'font/woff2' : extension === 'woff' ? 'font/woff' : 'font/ttf';
    const data = (await fs.readFile(path.join(directory, reference))).toString('base64');
    embedded = embedded.replaceAll(reference, `data:${mime};base64,${data}`);
  }
  return embedded;
}

export async function loadTheme(projectRoot: string, theme = 'default'): Promise<string> {
  const themeDir = path.resolve(projectRoot, 'themes', theme);
  const files = ['theme.css', 'components.css', 'print.css'];
  const parts = await Promise.all(files.map((file) => fs.readFile(path.join(themeDir, file), 'utf8')));
  const shared = await fs.readFile(path.join(projectRoot, 'themes', 'shared.css'), 'utf8');
  return [...parts, shared, await loadKatexCss()].join('\n');
}
