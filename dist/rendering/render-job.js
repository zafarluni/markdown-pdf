import fs from 'node:fs/promises';
import path from 'node:path';
import { markdownFiles } from '../input/files.js';
import { buildCombinedHtml, buildHtml } from './html-document.js';
import { writePdf } from './pdf-renderer.js';
import { loadTheme } from './theme-loader.js';
import { typstAvailable, writeTypstPdf } from './typst-renderer.js';
export async function renderJob(inputPath, outputPath, config, projectRoot) {
    const files = await markdownFiles(inputPath, config.exclude);
    if (!files.length)
        throw new Error(`No Markdown files found in ${inputPath}`);
    const inputIsDirectory = (await fs.stat(inputPath)).isDirectory();
    const engine = config.engine === 'typst' || (config.engine !== 'chromium' && typstAvailable(config))
        ? 'typst' : 'chromium';
    const stylesheet = engine === 'chromium' ? await loadTheme(projectRoot, config.theme) : '';
    const outputs = [];
    if (config.combined) {
        const output = outputPath.toLowerCase().endsWith('.pdf') ? outputPath : path.join(outputPath, 'revision-book.pdf');
        if (engine === 'typst')
            await writeTypstPdf(files, output, config);
        else
            await writePdf(await buildCombinedHtml(files, config, stylesheet), output, config);
        outputs.push(output);
    }
    else {
        const singleOutputFile = files.length === 1 && outputPath.toLowerCase().endsWith('.pdf');
        for (const file of files) {
            const relative = inputIsDirectory ? path.relative(inputPath, file) : path.basename(file);
            const output = singleOutputFile ? outputPath : path.join(outputPath, `${relative.replace(/\.[^.]+$/, '')}.pdf`);
            if (engine === 'typst')
                await writeTypstPdf([file], output, config);
            else
                await writePdf(await buildHtml(file, { ...config, startEachFileOnNewPage: false }, stylesheet), output, config);
            outputs.push(output);
        }
    }
    return { files, outputs, engine };
}
