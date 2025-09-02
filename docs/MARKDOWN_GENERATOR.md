# Markdown Generator Documentation

## Overview

The Markdown Generator is a TypeScript-based system for programmatically creating well-formatted Markdown documents. It uses a tree-based node structure that allows for composable, type-safe Markdown generation.

## Core Components

### MarkdownFormatter Class

The main formatter class that converts `MarkdownNode` objects into markdown strings.

```typescript
import { MarkdownFormatter, MarkdownNode } from '@/app/server/markdown';

const formatter = new MarkdownFormatter();
const markdown = formatter.format(documentNode);
```

### MarkdownNode Interface

The base interface for all markdown elements:

```typescript
interface MarkdownNode {
  type: string;
  content?: string;
  children?: MarkdownNode[];
  level?: number; // for headings (1-6)
  ordered?: boolean; // for lists
  url?: string; // for links
  language?: string; // for code blocks
}
```

## Supported Markdown Elements

### 1. Headings

Create headings from level 1 (h1) to level 6 (h6):

```typescript
import { heading } from '@/app/server/markdown';

const h1 = heading(1, 'Main Title');
const h2 = heading(2, 'Section Title');
const h3 = heading(3, 'Subsection Title');
```

**Output:**

```markdown
# Main Title

## Section Title

### Subsection Title
```

### 2. Paragraphs

Create simple text paragraphs:

```typescript
import { paragraph } from '@/app/server/markdown';

const simpleParagraph = paragraph('This is a simple paragraph of text.');
```

**Output:**

```markdown
This is a simple paragraph of text.
```

### 3. Rich Paragraphs with Formatting

Combine multiple formatting elements in a single paragraph:

```typescript
import { richParagraph, bold, inlineCode, link } from '@/app/server/markdown';

const richParagraph = richParagraph([
  "This paragraph contains ",
  bold("bold text"),
  " and ",
  inlineCode("inline code"),
  " and a ",
  link("https://example.com", "link"),
  "."
]);
```

**Output:**

```markdown
This paragraph contains **bold text** and `inline code` and a [link](https://example.com).
```

### 4. Lists

#### Unordered Lists

```typescript
import { unorderedList } from '@/app/server/markdown';

const bulletList = unorderedList(['First item', 'Second item', 'Third item']);
```

**Output:**

```markdown
- First item
- Second item
- Third item
```

#### Ordered Lists

```typescript
import { orderedList } from '@/app/server/markdown';

const numberedList = orderedList(['First step', 'Second step', 'Third step']);
```

**Output:**

```markdown
1. First step
2. Second step
3. Third step
```

### 5. Code Blocks

Create syntax-highlighted code blocks:

```typescript
import { codeBlock } from '@/app/server/markdown';

const jsCode = codeBlock(
  `function greet(name) {
  return \`Hello, \${name}!\`;
}`,
  'javascript',
);

const plainCode = codeBlock('npm install typescript');
```

**Output:**

```markdown
\`\`\`javascript
function greet(name) {
return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`
npm install typescript
\`\`\`
```

### 6. Inline Code

Highlight code within text:

```typescript
import { inlineCode } from '@/app/server/markdown';

const code = inlineCode('npm install');
```

**Output:**

```markdown
\`npm install\`
```

### 7. Bold Text

Make text bold:

```typescript
import { bold } from '@/app/server/markdown';

const boldText = bold('Important notice');
```

**Output:**

```markdown
**Important notice**
```

### 8. Links

Create clickable links:

```typescript
import { link } from '@/app/server/markdown';

const externalLink = link('https://github.com', 'GitHub');
const emailLink = link('mailto:user@example.com', 'Contact Us');
```

**Output:**

```markdown
[GitHub](https://github.com)
[Contact Us](mailto:user@example.com)
```

## Creating Complete Documents

Use the `document()` function to combine multiple elements:

```typescript
import { codeBlock, document, heading, paragraph, unorderedList } from '@/app/server/markdown';

const fullDocument = document(
  heading(1, 'API Documentation'),
  paragraph('Welcome to our API documentation.'),

  heading(2, 'Quick Start'),
  paragraph('Follow these steps to get started:'),
  unorderedList(['Install the package', 'Configure your API key', 'Make your first request']),

  heading(2, 'Example'),
  paragraph("Here's a basic example:"),
  codeBlock(
    `const api = new ApiClient('your-key');
const result = await api.get('/users');`,
    'javascript',
  ),
);
```

## Advanced Usage Patterns

### 1. Dynamic Content Generation

Generate markdown from data structures:

```typescript
function generateApiEndpointDocs(endpoints: ApiEndpoint[]) {
  const sections = endpoints
    .map((endpoint) => [
      heading(3, `${endpoint.method} ${endpoint.path}`),
      paragraph(endpoint.description),

      ...(endpoint.parameters?.length
        ? [paragraph('Parameters:'), unorderedList(endpoint.parameters.map((p) => `${p.name}: ${p.description}`))]
        : []),

      ...(endpoint.example ? [paragraph('Example:'), codeBlock(endpoint.example, 'json')] : []),
    ])
    .flat();

  return document(heading(1, 'API Endpoints'), ...sections);
}
```

### 2. Template-Based Generation

Create reusable templates:

```typescript
function createChangelogEntry(version: string, changes: Change[]) {
  const changesByType = groupBy(changes, 'type');

  const sections = Object.entries(changesByType)
    .map(([type, items]) => [
      heading(3, `${type.charAt(0).toUpperCase()}${type.slice(1)}`),
      unorderedList(items.map((item) => item.description)),
    ])
    .flat();

  return document(heading(2, `Version ${version}`), ...sections);
}
```

### 3. Conditional Content

Include content based on conditions:

```typescript
function generateProjectReadme(project: Project) {
  return document(
    heading(1, project.name),
    paragraph(project.description),

    ...(project.installation ? [heading(2, 'Installation'), codeBlock(project.installation, 'bash')] : []),

    ...(project.features?.length ? [heading(2, 'Features'), unorderedList(project.features)] : []),

    ...(project.examples?.length
      ? [
          heading(2, 'Examples'),
          ...project.examples
            .map((example) => [
              heading(3, example.title),
              paragraph(example.description),
              codeBlock(example.code, example.language),
            ])
            .flat(),
        ]
      : []),
  );
}
```

## AI Agent Usage Guidelines

### For Content Generation

1. **Structure First**: Plan the document hierarchy with headings before adding content
2. **Use Rich Paragraphs**: Combine formatting elements for better readability
3. **Code Examples**: Always include language hints for code blocks when possible
4. **Consistent Formatting**: Use the utility functions rather than raw string manipulation

### For Data-Driven Documents

1. **Map Data to Nodes**: Convert your data structures to MarkdownNode arrays
2. **Handle Empty States**: Use conditional rendering for optional content
3. **Batch Operations**: Build sections as arrays then spread them into documents

### Error Prevention

1. **Validate URLs**: Ensure links have proper protocols
2. **Escape Content**: Be careful with special characters in code blocks
3. **Check Nesting**: Avoid deeply nested structures that might be hard to read

## Performance Considerations

- The formatter processes nodes recursively, so very deep nesting should be avoided
- Large documents should be built incrementally rather than as single large operations
- Consider streaming output for very large documents

## Integration with Atlas Workflow

This markdown generator is designed to work with the Atlas document workflow:

```typescript
// Example: Generate diff reports
function generateAtlasChangeReport(changes: AtlasChange[]) {
  return document(
    heading(1, 'Atlas Document Changes'),
    paragraph(`Found ${changes.length} changes in the Atlas documents.`),

    ...changes
      .map((change) => [
        heading(2, change.documentTitle),
        paragraph(`Status: ${change.status}`),

        ...(change.additions?.length ? [heading(3, 'Additions'), unorderedList(change.additions)] : []),

        ...(change.modifications?.length ? [heading(3, 'Modifications'), unorderedList(change.modifications)] : []),

        ...(change.deletions?.length ? [heading(3, 'Deletions'), unorderedList(change.deletions)] : []),
      ])
      .flat(),
  );
}
```

## Testing

The system includes comprehensive examples in `app/server/markdown/example.ts` that demonstrate all features and can be used as test cases for AI agents learning the system.
