export type PdfConfig = {
  input?: string;
  output?: string;
  theme?: string;
  engine?: 'chromium' | 'typst' | 'auto';
  paper?: 'A4' | 'Letter';
  margin?: 'narrow' | 'normal' | 'wide';
  combined?: boolean;
  startEachFileOnNewPage?: boolean;
  title?: string;
  toc?: boolean;
  pandocPath?: string;
  typstPath?: string;
  exclude?: string[];
};
