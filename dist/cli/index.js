#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { markdownFiles } from '../input/files.js';
import { splitIntoSections } from '../markdown/sections.js';
import { renderJob } from '../rendering/render-job.js';
import { findTool, typstAvailable } from '../rendering/typst-renderer.js';
import { startPreview } from '../preview/server.js';
import { helpText } from './help.js';
const program = new Command();
const projectRoot = path.resolve(import.meta.dirname, '../..');
program.name('mdpdf').version('0.2.0').description('Convert Markdown study notes into readable, navigable PDFs')
    .showHelpAfterError('(use --help for usage information)')
    .showSuggestionAfterError();
function resolveConfig(options, command) {
    const loaded = loadConfig(process.cwd(), String(options.config ?? 'pdf.config.yaml'));
    const config = { ...loaded };
    for (const key of ['output', 'theme', 'paper', 'margin', 'engine', 'combined', 'toc']) {
        if (command.getOptionValueSource(key) === 'cli') {
            config[key] = options[key];
        }
    }
    if (command.getOptionValueSource('newPages') === 'cli')
        config.startEachFileOnNewPage = Boolean(options.newPages);
    if (command.getOptionValueSource('pandoc') === 'cli')
        config.pandocPath = String(options.pandoc);
    if (command.getOptionValueSource('typst') === 'cli')
        config.typstPath = String(options.typst);
    if (config.engine && !['auto', 'chromium', 'typst'].includes(config.engine))
        throw new Error(`Unknown engine: ${config.engine}`);
    if (config.paper && !['A4', 'Letter'].includes(config.paper))
        throw new Error(`Unknown paper size: ${config.paper}`);
    if (config.margin && !['narrow', 'normal', 'wide'].includes(config.margin))
        throw new Error(`Unknown margin: ${config.margin}`);
    return config;
}
function inputPath(argument, config) {
    return path.resolve(process.cwd(), argument === '.' ? (config.input ?? '.') : argument);
}
program.command('render')
    .description('Render a Markdown file or directory to one or more PDFs')
    .argument('[input]', 'Markdown file or directory', '.')
    .option('-o, --output <path>', 'PDF file or output directory')
    .option('-t, --theme <name>', 'default, academic, minimal, or modern')
    .option('--engine <name>', 'auto, typst, or chromium')
    .option('--pandoc <path>', 'Pandoc executable')
    .option('--typst <path>', 'Typst executable')
    .option('--paper <size>', 'A4 or Letter')
    .option('--margin <width>', 'narrow, normal, or wide')
    .option('--combined', 'combine all Markdown files into one PDF')
    .option('--no-new-pages', 'continue between files in a combined PDF')
    .option('--toc', 'include a table of contents')
    .option('--no-toc', 'omit a table of contents')
    .option('--config <path>', 'configuration file', 'pdf.config.yaml')
    .action(async (input, options, command) => {
    const config = resolveConfig(options, command);
    const source = inputPath(input, config);
    const output = path.resolve(process.cwd(), config.output ?? './pdf-output');
    const result = await renderJob(source, output, config, projectRoot);
    for (const file of result.outputs)
        console.log(`Created ${file} (${result.engine})`);
});
program.command('preview').argument('[input]', 'Markdown file or directory', '.')
    .description('Open a local PDF preview with layout controls')
    .option('-t, --theme <name>', 'layout theme')
    .option('--engine <name>', 'auto, typst, or chromium')
    .option('--pandoc <path>', 'Pandoc executable')
    .option('--typst <path>', 'Typst executable')
    .option('--paper <size>', 'A4 or Letter')
    .option('--margin <width>', 'narrow, normal, or wide')
    .option('--toc', 'include a table of contents')
    .option('--no-toc', 'omit a table of contents')
    .option('--config <path>', 'configuration file', 'pdf.config.yaml')
    .action(async (input, options, command) => {
    const config = resolveConfig(options, command);
    await startPreview(inputPath(input, config), config, projectRoot);
});
program.command('check').description('Inspect Markdown inputs without rendering a PDF')
    .argument('[input]', 'Markdown file or directory', '.')
    .option('--config <path>', 'configuration file', 'pdf.config.yaml')
    .action(async (input, options) => {
    const config = loadConfig(process.cwd(), options.config);
    const files = await markdownFiles(inputPath(input, config), config.exclude);
    console.log(`${files.length} Markdown file(s) found.`);
    for (const file of files) {
        const source = await fs.readFile(file, 'utf8');
        const mermaid = /^\s*```mermaid\b/m.test(source);
        console.log(`${path.relative(process.cwd(), file)}: ${splitIntoSections(source).length} section(s)${mermaid ? ' (Mermaid diagrams need an SVG export)' : ''}`);
    }
});
program.command('doctor').description('Show available PDF engines')
    .option('--config <path>', 'configuration file', 'pdf.config.yaml')
    .action((options) => {
    const config = loadConfig(process.cwd(), options.config);
    console.log(`Pandoc: ${findTool('pandoc', config.pandocPath) ?? 'not found'}`);
    console.log(`Typst: ${findTool('typst', config.typstPath) ?? 'not found'}`);
    console.log(`Automatic engine: ${typstAvailable(config) ? 'typst' : 'chromium'}`);
});
program.command('themes').description('List the available PDF themes').action(async () => {
    const themesPath = path.resolve(projectRoot, 'themes');
    const entries = await fs.readdir(themesPath, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        console.log(entry.name);
    }
});
program.addHelpText('before', `${helpText}\n\n`);
program.parseAsync().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
});
