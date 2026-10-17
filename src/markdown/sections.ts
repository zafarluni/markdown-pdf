export type MarkdownSection = {
  level: number;
  title: string;
  source: string;
  pageBreakBefore: boolean;
};

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function splitIntoSections(source: string, pageBreakBefore = false): MarkdownSection[] {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const sections: MarkdownSection[] = [];
  let current: string[] = [];
  let level = 0;
  let title = '';
  let fenceChar = '';
  let fenceLength = 0;

  const push = () => {
    if (current.some((line) => line.trim())) {
      sections.push({ level, title, source: current.join('\n'), pageBreakBefore: pageBreakBefore && sections.length === 0 });
    }
  };

  for (const line of lines) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
        fenceChar = '';
        fenceLength = 0;
      }
    }

    const match = !fenceChar && line.match(headingPattern);
    if (match) {
      push();
      current = [line];
      level = match[1].length;
      title = match[2];
    } else {
      current.push(line);
    }
  }
  push();
  return sections;
}
