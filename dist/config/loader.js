import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
export const defaultConfig = {
    input: '.',
    output: './pdf-output',
    theme: 'default',
    engine: 'auto',
    paper: 'A4',
    margin: 'normal',
    combined: false,
    startEachFileOnNewPage: true,
    toc: false,
    exclude: ['backup-original-notes', 'markdown-pdf', 'node_modules', 'pdf-output']
};
export function loadConfig(cwd, file = 'pdf.config.yaml') {
    const configPath = path.resolve(cwd, file);
    if (!existsSync(configPath))
        return { ...defaultConfig };
    const parsed = YAML.parse(readFileSync(configPath, 'utf8'));
    return { ...defaultConfig, ...(parsed ?? {}) };
}
