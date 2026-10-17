import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PdfConfig } from '../config/types.js';

const execFileAsync = promisify(execFile);
type ToolNames = 'pandoc' | 'typst';

const palettes: Record<string, { accent: string; dark: string; ink: string; line: string; font: string }> = {
  default: { accent: '#176b87', dark: '#10465a', ink: '#172033', line: '#dce5eb', font: 'Segoe UI' },
  academic: { accent: '#315b7d', dark: '#1e3d58', ink: '#20242b', line: '#cfd7de', font: 'Georgia' },
  minimal: { accent: '#252525', dark: '#111111', ink: '#252525', line: '#d9d9d9', font: 'Segoe UI' },
  modern: { accent: '#e16b4f', dark: '#243044', ink: '#243044', line: '#dce2eb', font: 'Segoe UI' }
};

export function findTool(name: ToolNames, configured?: string): string | undefined {
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const environment = process.env[`MDPDF_${name.toUpperCase()}`];
  const candidates = [configured, environment, ...((process.env.PATH ?? '').split(path.delimiter).map((entry) => path.join(entry, executable)))];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const local = process.env.LOCALAPPDATA;
    if (name === 'pandoc') candidates.push(path.join(local, 'Pandoc', executable));
    if (name === 'typst') {
      const packages = path.join(local, 'Microsoft', 'WinGet', 'Packages');
      try {
        for (const entry of fs.readdirSync(packages).filter((entry) => entry.startsWith('Typst.Typst_'))) {
          candidates.push(path.join(packages, entry, 'typst-x86_64-pc-windows-msvc', executable));
        }
      } catch { /* PATH and configured paths still work. */ }
    }
  }
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  return found ? path.resolve(found) : undefined;
}

export function typstAvailable(config: PdfConfig): boolean {
  return Boolean(findTool('pandoc', config.pandocPath) && findTool('typst', config.typstPath));
}

function styleFor(config: PdfConfig): string {
  const palette = palettes[config.theme ?? 'default'];
  if (!palette) throw new Error(`Unknown theme: ${config.theme}`);
  const margin = config.margin === 'narrow' ? 11 : config.margin === 'wide' ? 23 : 16;
  const font = JSON.stringify(palette.font);
  const compact = config.theme === 'minimal';
  return `#let accent = rgb("${palette.accent}")
#let dark = rgb("${palette.dark}")
#let ink = rgb("${palette.ink}")
#let line-color = rgb("${palette.line}")
#set page(margin: (top: 18mm, bottom: 18mm, left: ${margin}mm, right: ${margin}mm))
#set text(font: (${font}, "Arial", "Libertinus Serif"), size: ${compact ? '10pt' : '11pt'}, fill: ink)
#set par(justify: false, leading: ${compact ? '0.65em' : '0.8em'}, spacing: ${compact ? '0.6em' : '0.75em'})
#set heading(numbering: none)
#show heading.where(level: 1): set text(size: 23pt, weight: "bold", fill: dark)
#show heading.where(level: 1): set block(above: 1.1em, below: 0.5em)
#show heading.where(level: 2): set text(size: 15pt, weight: "bold", fill: dark)
#show heading.where(level: 2): set block(above: 1.2em, below: 0.4em)
#show heading.where(level: 3): set text(size: 12pt, weight: "bold", fill: dark)
#show heading.where(level: 3): set block(above: 1em, below: 0.3em)
#set table(stroke: 0.4pt + line-color, inset: 5pt)
`;
}

async function runTool(executable: string, args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync(executable, args, { cwd, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    const details = error as Error & { stderr?: string };
    throw new Error(`${path.basename(executable)} failed: ${details.stderr?.trim() || details.message}`);
  }
}

export async function writeTypstPdf(files: string[], output: string, config: PdfConfig): Promise<void> {
  const pandoc = findTool('pandoc', config.pandocPath);
  const typst = findTool('typst', config.typstPath);
  if (!pandoc || !typst) {
    throw new Error('Typst rendering requires Pandoc and Typst. Install both, or set MDPDF_PANDOC and MDPDF_TYPST to their executable paths.');
  }
  await fsp.mkdir(path.dirname(output), { recursive: true });
  const staging = await fsp.mkdtemp(path.join(path.dirname(output), '.mdpdf-'));
  try {
    await fsp.writeFile(path.join(staging, 'style.typ'), styleFor(config), 'utf8');
    let input = files[0];
    if (files.length > 1) {
      const sources = await Promise.all(files.map((file) => fsp.readFile(file, 'utf8')));
      const separator = config.startEachFileOnNewPage
        ? '\n\n```{=typst}\n#pagebreak()\n```\n\n'
        : '\n\n';
      input = path.join(staging, 'combined.md');
      await fsp.writeFile(input, sources.join(separator), 'utf8');
    }
    const resourcePaths = [...new Set(files.map((file) => path.dirname(file)))].join(path.delimiter);
    const args = [input, '-f', 'markdown-raw_html', '-t', 'typst', '--standalone',
      '--resource-path', resourcePaths, '--extract-media=media', '-B', 'style.typ',
      '-V', `papersize=${(config.paper ?? 'A4').toLowerCase() === 'letter' ? 'us-letter' : 'a4'}`,
      '-V', 'page-numbering=1', '-o', 'document.typ'];
    if (config.toc) args.push('--toc');
    await runTool(pandoc, args, staging);
    await runTool(typst, ['compile', 'document.typ', 'document.pdf'], staging);
    await fsp.copyFile(path.join(staging, 'document.pdf'), output);
  } finally {
    await fsp.rm(staging, { recursive: true, force: true });
  }
}
