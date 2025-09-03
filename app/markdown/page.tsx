import { renderMarkdown } from '../server/markdown/render';

const markdownInput = `# Markdown Demo

This is a **bold** text and this is *italic*.

## Features

- Lists work great
- So do links: [Next.js](https://nextjs.org)
- And code blocks:

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

> Blockquotes are also supported!

### Math and more

You can write inline code like \`const x = 42\` or create tables:

| Feature | Status |
|---------|--------|
| Markdown | ✅ |
| Server-side | ✅ |
| Next.js | ✅ |
`;

export default function MarkdownPage() {
  const htmlOutput = renderMarkdown(markdownInput);

  return (
    <div className="typography container mx-auto min-h-screen max-w-6xl p-8">
      <h1 className="mb-8 text-center text-3xl font-bold">Markdown Renderer Demo</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-semibold text-blue-600">Markdown Source</h2>
          <pre className="h-full overflow-auto rounded-lg border bg-gray-50 p-4 text-sm">
            <code className="text-gray-800">{markdownInput}</code>
          </pre>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold text-green-600">Rendered Output</h2>
          <div
            className="prose prose-lg h-full max-w-none overflow-auto rounded-lg border bg-white p-4"
            dangerouslySetInnerHTML={{ __html: htmlOutput }}
          />
        </div>
      </div>

      <div className="mt-16 rounded-lg bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> This page renders markdown on the server using markdown-it. The HTML is generated
          during the server-side rendering process.
        </p>
      </div>
    </div>
  );
}
