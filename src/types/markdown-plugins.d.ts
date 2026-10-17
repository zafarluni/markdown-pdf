declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it';
  const footnote: (parser: MarkdownIt) => void;
  export default footnote;
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';
  const taskLists: (parser: MarkdownIt, options?: { enabled?: boolean }) => void;
  export default taskLists;
}
