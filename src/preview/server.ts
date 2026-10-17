import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { PdfConfig } from '../config/types.js';
import { renderJob } from '../rendering/render-job.js';

type PreviewOptions = Pick<PdfConfig, 'theme' | 'paper' | 'margin' | 'engine' | 'toc'>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character);
}

function page(title: string, token: string, initial: PreviewOptions): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>mdpdf preview</title>
<style>
  :root { color-scheme: light; font: 15px/1.4 system-ui, sans-serif; color: #172033; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9eef2; }
  header { padding: 14px 20px; background: #fff; border-bottom: 1px solid #ced8df; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; color: #10465a; }
  .source { color: #5d6a78; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 35vw; }
  form { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; }
  label { display: grid; gap: 3px; color: #536271; font-size: 12px; }
  select, button, a.download { font: inherit; padding: 7px 10px; border-radius: 5px; border: 1px solid #b9c7d0; background: white; color: #172033; }
  button { background: #176b87; color: white; border-color: #176b87; cursor: pointer; }
  a.download { text-decoration: none; }
  .check { display: flex; align-items: center; gap: 5px; padding-bottom: 8px; }
  #status { padding: 6px 20px; min-height: 31px; font-size: 13px; color: #536271; }
  iframe { display: block; width: 100%; height: calc(100vh - 150px); border: 0; background: #d4dce2; }
</style></head><body>
<header><h1>mdpdf preview</h1><span class="source" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
<form id="controls">
  <label>Layout<select name="theme"><option>default</option><option>academic</option><option>minimal</option><option>modern</option></select></label>
  <label>Engine<select name="engine"><option>auto</option><option>typst</option><option>chromium</option></select></label>
  <label>Paper<select name="paper"><option>A4</option><option>Letter</option></select></label>
  <label>Margin<select name="margin"><option>normal</option><option>narrow</option><option>wide</option></select></label>
  <label class="check"><input type="checkbox" name="toc"> Contents</label>
  <button type="submit">Render</button>
  <a class="download" href="/pdf" download="notes.pdf">Download PDF</a>
</form></header>
<div id="status" role="status">Ready</div><iframe id="document" title="PDF preview" src="/pdf"></iframe>
<script>
const token = ${JSON.stringify(token)};
const initial = ${JSON.stringify(initial)};
const form = document.querySelector('#controls');
const status = document.querySelector('#status');
const frame = document.querySelector('#document');
let revision = -1;
for (const key of ['theme', 'engine', 'paper', 'margin']) form.elements[key].value = initial[key];
form.elements.toc.checked = Boolean(initial.toc);
async function render() {
  const data = Object.fromEntries(new FormData(form));
  data.toc = form.elements.toc.checked;
  status.textContent = 'Rendering…';
  try {
    const response = await fetch('/render', { method: 'POST', headers: { 'content-type': 'application/json', 'x-preview-token': token }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    status.textContent = 'Ready · ' + result.engine + ' · ' + result.file;
    frame.src = '/pdf?v=' + Date.now();
  } catch (error) { status.textContent = 'Error: ' + error.message; }
}
form.addEventListener('submit', (event) => { event.preventDefault(); render(); });
setInterval(async () => {
  try {
    const response = await fetch('/revision');
    const result = await response.json();
    if (revision < 0) revision = result.revision;
    else if (revision !== result.revision) { revision = result.revision; render(); }
  } catch {}
}, 1500);
</script></body></html>`;
}

async function readBody(request: http.IncomingMessage): Promise<string> {
  let data = '';
  for await (const chunk of request) {
    data += chunk.toString();
    if (data.length > 16_384) throw new Error('Request too large');
  }
  return data;
}

export async function startPreview(input: string, config: PdfConfig, projectRoot: string): Promise<void> {
  const title = path.basename(input);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mdpdf-preview-'));
  const output = path.join(temporary, 'preview.pdf');
  const isDirectory = (await fs.stat(input)).isDirectory();
  let current: PreviewOptions = {
    theme: config.theme, paper: config.paper, margin: config.margin, engine: config.engine, toc: config.toc
  };
  let revision = 0;
  let queue = Promise.resolve();
  const token = randomBytes(24).toString('hex');
  const render = async (options: PreviewOptions) => {
    const result = await renderJob(input, output, { ...config, ...options, combined: isDirectory || config.combined }, projectRoot);
    return result.engine;
  };
  try {
    await render(current);
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(page(title, token, current));
      } else if (request.method === 'GET' && url.pathname === '/pdf') {
        response.writeHead(200, { 'content-type': 'application/pdf', 'cache-control': 'no-store' });
        response.end(await fs.readFile(output));
      } else if (request.method === 'GET' && url.pathname === '/revision') {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ revision }));
      } else if (request.method === 'POST' && url.pathname === '/render') {
        if (request.headers['x-preview-token'] !== token) throw new Error('Invalid preview token');
        const options = JSON.parse(await readBody(request)) as PreviewOptions;
        if (!['default', 'academic', 'minimal', 'modern'].includes(options.theme ?? '')) throw new Error('Invalid layout');
        if (!['auto', 'typst', 'chromium'].includes(options.engine ?? '')) throw new Error('Invalid engine');
        if (!['A4', 'Letter'].includes(options.paper ?? '')) throw new Error('Invalid paper size');
        if (!['normal', 'narrow', 'wide'].includes(options.margin ?? '')) throw new Error('Invalid margin');
        current = { ...options, toc: Boolean(options.toc) };
        const selected = { ...current };
        const task = queue.then(() => render(selected));
        queue = task.then(() => undefined, () => undefined);
        const engine = await task;
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ engine, file: title }));
      } else {
        response.writeHead(404);
        response.end('Not found');
      }
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Preview server did not start');
  console.log(`Preview: http://127.0.0.1:${address.port}/`);
  console.log('Press Ctrl+C to stop.');
  const watcher = (await import('node:fs')).watch(input, { recursive: isDirectory }, () => { revision++; });
  process.once('SIGINT', () => {
    watcher?.close();
    server.close();
    void fs.rm(temporary, { recursive: true, force: true }).then(() => process.exit(0));
  });
}
