import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderJob } from '../dist/rendering/render-job.js';
import { typstAvailable } from '../dist/rendering/typst-renderer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'tests', 'fixtures');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mdpdf-test-'));
after(async () => { await fs.rm(temporary, { recursive: true, force: true }); });

async function readPdf(file) {
  const document = await getDocument({ data: new Uint8Array(await fs.readFile(file)), useSystemFonts: true }).promise;
  const pages = [];
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' '));
  }
  const outline = await document.getOutline();
  return { pages, outline };
}

function baseConfig(engine) {
  return { engine, theme: 'default', paper: 'A4', margin: 'normal', combined: false, toc: false, startEachFileOnNewPage: true, exclude: [] };
}

test('Chromium renders equations, footnotes, and bookmarks', async () => {
  const output = path.join(temporary, 'study-chromium.pdf');
  await renderJob(path.join(fixtures, 'study-notes.md'), output, baseConfig('chromium'), root);
  const pdf = await readPdf(output);
  assert.equal(pdf.pages.length, 1, 'the short note should not leave its footnote alone on another page');
  assert.match(pdf.pages[0], /Kinetic energy/);
  assert.match(pdf.pages[0], /A short footnote used to check scholarly notes/);
  assert.doesNotMatch(pdf.pages[0], /\\frac|\$\$/);
  assert.ok(pdf.outline?.length, 'PDF should contain a heading outline');
});

test('Chromium keeps a definition with its heading and a short table together', async () => {
  const output = path.join(temporary, 'pagination-chromium.pdf');
  await renderJob(path.join(fixtures, 'pagination-notes.md'), output, baseConfig('chromium'), root);
  const pdf = await readPdf(output);
  const definition = pdf.pages.find((page) => page.includes('Definition: diffusion'));
  assert.ok(definition?.includes('Diffusion is the net movement'), 'heading and definition must share a page');
  const examples = pdf.pages.find((page) => page.includes('Examples'));
  assert.ok(examples?.includes('Perfume') && examples.includes('Oxygen'), 'short table rows must share a page');
});

test('combined Chromium PDF has a single contents list and both documents', async () => {
  const output = path.join(temporary, 'combined-chromium.pdf');
  const config = { ...baseConfig('chromium'), combined: true, toc: true };
  await renderJob(fixtures, output, config, root);
  const pdf = await readPdf(output);
  const allText = pdf.pages.join(' ');
  assert.match(allText, /Contents/);
  assert.match(allText, /Energy and motion/);
  assert.match(allText, /Reading a small program/);
  assert.ok(pdf.pages.length >= 3, 'each file starts on a new page in combined mode');
});

test('Typst renders footnotes and local diagrams when installed', { skip: !typstAvailable(baseConfig('auto')) }, async () => {
  const config = baseConfig('typst');
  const study = path.join(temporary, 'study-typst.pdf');
  await renderJob(path.join(fixtures, 'study-notes.md'), study, config, root);
  const pdf = await readPdf(study);
  assert.match(pdf.pages.join(' '), /A short footnote used to check scholarly notes/);
  const definition = pdf.pages.find((page) => page.includes('Kinetic energy'));
  assert.ok(definition?.includes('energy an object has'), 'Typst heading and definition must share a page');

  const image = path.join(temporary, 'image-typst.pdf');
  await renderJob(path.join(fixtures, 'image-notes.md'), image, config, root);
  assert.ok((await fs.stat(image)).size > 10_000, 'local SVG should be embedded in the PDF');

  const pagination = path.join(temporary, 'pagination-typst.pdf');
  await renderJob(path.join(fixtures, 'pagination-notes.md'), pagination, config, root);
  const longNote = await readPdf(pagination);
  assert.ok(longNote.pages.length >= 2, 'the pagination fixture must span pages to exercise page breaks');
  const definitionPage = longNote.pages.find((page) => page.includes('Definition: diffusion'));
  assert.ok(definitionPage?.includes('Diffusion is the net movement'), 'Typst heading and definition must share a page');
  const examplesPage = longNote.pages.find((page) => page.includes('Examples'));
  assert.ok(examplesPage?.includes('Perfume') && examplesPage.includes('Oxygen'), 'Typst short table must stay with its heading');
});
