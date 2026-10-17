export const helpText = `mdpdf — convert Markdown study notes into polished PDFs

USAGE
  mdpdf <command> [input] [options]

COMMANDS
  render [input] [options]  Render a Markdown file or directory
  preview [input]           Open a local preview with layout controls
  check [input]             Inspect files without creating a PDF
  doctor                    Check available PDF engines
  themes                    List available themes

QUICK START
  mdpdf render notes.md --output notes.pdf
  mdpdf render ./notes --combined --toc --output revision-book.pdf
  mdpdf preview notes.md

COMMON OPTIONS
  --theme <name>            default, academic, minimal, or modern
  --engine <name>           auto, typst, or chromium
  --paper <size>            A4 or Letter
  --margin <width>          narrow, normal, or wide
  --config <path>           Configuration file (default: pdf.config.yaml)

NOTES
  Run commands from the directory containing your Markdown files. Use
  "mdpdf <command> --help" for command-specific options and examples.
  CLI options override pdf.config.yaml. Source Markdown is never modified.`;
