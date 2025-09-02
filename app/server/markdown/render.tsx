import markdownit from 'markdown-it';

const md = markdownit();

export const renderMarkdown = (markdown: string) => {
  return md.render(markdown);
};
