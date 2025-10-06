import markdownit from 'markdown-it';

const md = markdownit();

export const markdownToHTML = (markdown: string) => {
  return md.render(markdown);
};
