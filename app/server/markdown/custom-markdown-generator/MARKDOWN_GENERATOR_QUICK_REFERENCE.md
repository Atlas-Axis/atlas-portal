# Markdown Generator Quick Reference

## Import Statement

```typescript
import {
  bold,
  codeBlock,
  document,
  heading,
  inlineCode,
  link,
  orderedList,
  paragraph,
  richParagraph,
  unorderedList,
} from '@/app/server/markdown';
```

## Basic Elements

| Element     | Function               | Example                                  |
| ----------- | ---------------------- | ---------------------------------------- |
| Heading     | `heading(level, text)` | `heading(1, "Title")`                    |
| Paragraph   | `paragraph(text)`      | `paragraph("Simple text")`               |
| Bold        | `bold(text)`           | `bold("Important")`                      |
| Inline Code | `inlineCode(text)`     | `inlineCode("console.log()")`            |
| Link        | `link(url, text)`      | `link("https://example.com", "Example")` |

## Lists

```typescript
// Unordered list
unorderedList(['Item 1', 'Item 2', 'Item 3']);

// Ordered list
orderedList(['Step 1', 'Step 2', 'Step 3']);
```

## Code Blocks

```typescript
// With language
codeBlock('const x = 1;', 'javascript');

// Without language
codeBlock('npm install package');
```

## Rich Paragraphs

```typescript
richParagraph(['Text with ', bold('bold'), ' and ', inlineCode('code'), ' and ', link('url', 'link')]);
```

## Complete Document

```typescript
const doc = document(
  heading(1, 'Title'),
  paragraph('Introduction'),
  heading(2, 'Section'),
  unorderedList(['Item 1', 'Item 2']),
  codeBlock('code example', 'language'),
);
```

## Common Patterns

### API Documentation

```typescript
document(
  heading(1, 'API Reference'),
  heading(2, `${method} ${endpoint}`),
  paragraph(description),
  heading(3, 'Parameters'),
  unorderedList(parameters),
  heading(3, 'Example'),
  codeBlock(example, 'json'),
);
```

### Changelog Entry

```typescript
document(
  heading(2, `Version ${version}`),
  heading(3, 'Added'),
  unorderedList(additions),
  heading(3, 'Changed'),
  unorderedList(changes),
  heading(3, 'Fixed'),
  unorderedList(fixes),
);
```

### Tutorial Steps

```typescript
document(
  heading(1, 'Tutorial'),
  heading(2, 'Step 1'),
  paragraph('Description'),
  codeBlock('command', 'bash'),
  heading(2, 'Step 2'),
  paragraph('Description'),
  codeBlock('code', 'typescript'),
);
```

## Output Examples

| Input                       | Output                        |
| --------------------------- | ----------------------------- |
| `heading(1, "Title")`       | `# Title`                     |
| `bold("text")`              | `**text**`                    |
| `inlineCode("code")`        | `` `code` ``                  |
| `link("url", "text")`       | `[text](url)`                 |
| `unorderedList(["A", "B"])` | `- A`<br>`- B`                |
| `orderedList(["A", "B"])`   | `1. A`<br>`2. B`              |
| `codeBlock("code", "js")`   | ` ```js`<br>`code`<br>` ``` ` |
