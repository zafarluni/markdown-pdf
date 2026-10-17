# mdpdf

Convert LLM-generated Markdown notes to readable, navigable PDFs. The command line remains the main interface; `preview` provides local visual controls for layout decisions. Source Markdown is never modified.

## Install

Requires Node.js 20.11 or newer.

```powershell
npm install
npm run build
node dist/cli/index.js doctor
```

The **Typst engine** uses Pandoc and Typst executables. Install both and put them on `PATH`; on Windows, `winget install --exact --id JohnMacFarlane.Pandoc` and `winget install --exact --id Typst.Typst` are options. `MDPDF_PANDOC` and `MDPDF_TYPST` can point to portable executables instead. Run `mdpdf doctor` to see what the app found.

The **Chromium engine** uses Playwright's Chromium or a locally installed Chrome or Edge. For consistent output on different computers, run `npx playwright install chromium`.

`engine: auto` uses Typst when both Pandoc and Typst are available, then Chromium otherwise. The engine is printed beside each generated file. Use `--engine typst` or `--engine chromium` to choose explicitly.

## Commands

Run commands from the directory containing your notes. Replace `path/to/markdown-pdf` with this project's location.

```powershell
node path/to/markdown-pdf/dist/cli/index.js render notes.md --output notes.pdf
node path/to/markdown-pdf/dist/cli/index.js render ./notes --combined --toc --output revision-book.pdf
node path/to/markdown-pdf/dist/cli/index.js preview notes.md
node path/to/markdown-pdf/dist/cli/index.js check ./notes
```

Every command includes focused terminal help. Run `mdpdf --help` for a quick
overview, or `mdpdf render --help` / `mdpdf preview --help` for all options,
defaults, and accepted values. CLI options override values in
`pdf.config.yaml`; `mdpdf doctor` reports which rendering tools are available.

`preview` prints a localhost URL. Open it in a browser to compare the four layouts, paper size, margins, contents list, and engines. Saving the source file refreshes the preview. The interface shares the same rendering code as `render` and never sends notes to an external service.

Available themes: `default` (spacious study notes), `academic`, `minimal` (compact reference), and `modern`. `--paper A4|Letter` and `--margin narrow|normal|wide` adjust the printable area. Set options in `pdf.config.yaml` for repeated use; see [the example configuration](pdf.config.example.yaml).

## Supported notes

- Headings, lists, task lists, tables, blockquotes, images, and local SVG diagrams.
- Inline `$...$` and display `$$...$$` mathematics.
- Footnotes and highlighted fenced code blocks.
- Optional table of contents and PDF heading bookmarks.
- Short headings and explanations kept together where space permits; small tables and list items avoid awkward splits.

Raw HTML in Markdown is escaped in the Chromium engine. For diagrams written as Mermaid code fences, export an SVG and reference it as an image; `mdpdf check` flags Mermaid fences. Multilingual layout is reserved for a later version.

Page breaking is content-dependent. A block taller than a page must split, and keeping a short section together can leave some space at the bottom of the preceding page. The Typst engine gives the most consistent results for math, footnotes, and study documents; Chromium is useful for CSS-driven layouts and as an engine that needs fewer external tools.

## Tests

```powershell
npm test
```

The tests build the project, render representative notes, and inspect page text, section placement, and bookmarks. Typst checks run when Pandoc and Typst are available. Rendered pages are also visually inspected during layout changes.
