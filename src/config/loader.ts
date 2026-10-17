import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { PdfConfig } from './types.js';

export const defaultConfig: Omit<Required<PdfConfig>, 'title' | 'pandocPath' | 'typstPath'> = {
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

export function loadConfig(cwd: string, file = 'pdf.config.yaml'): PdfConfig {
  const configPath = path.resolve(cwd, file);
  if (!existsSync(configPath)) return { ...defaultConfig };
  const parsed = YAML.parse(readFileSync(configPath, 'utf8')) as PdfConfig | null;
  return { ...defaultConfig, ...(parsed ?? {}) };
}
