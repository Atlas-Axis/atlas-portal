/**
 * Example usage and test cases for the Markdown formatter
 * Run this with: npx tsx app/server/markdown/example.ts
 */
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
} from './index';

// Example 1: Simple document with headings and paragraphs
const example1 = document(
  heading(1, 'My Document'),
  paragraph('This is a simple paragraph with some text.'),
  heading(2, 'Getting Started'),
  paragraph("Here's how to get started with this project."),
);

console.log('=== Example 1: Basic Document ===');
console.log(example1);
console.log('\n');

// Example 2: Lists
const example2 = document(
  heading(2, 'Lists Example'),
  paragraph("Here's an unordered list:"),
  unorderedList(['First item', 'Second item', 'Third item']),
  paragraph("And here's an ordered list:"),
  orderedList(['Step one', 'Step two', 'Step three']),
);

console.log('=== Example 2: Lists ===');
console.log(example2);
console.log('\n');

// Example 3: Formatting and links
const example3 = document(
  heading(2, 'Formatting Example'),
  richParagraph([
    'This paragraph has ',
    bold('bold text'),
    ' and ',
    inlineCode('inline code'),
    ' and a ',
    link('https://example.com', 'link to somewhere'),
    '.',
  ]),
);

console.log('=== Example 3: Rich Formatting ===');
console.log(example3);
console.log('\n');

// Example 4: Code blocks
const example4 = document(
  heading(2, 'Code Example'),
  paragraph("Here's a TypeScript code block:"),
  codeBlock(
    `function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(hello("World"));`,
    'typescript',
  ),
);

console.log('=== Example 4: Code Block ===');
console.log(example4);
console.log('\n');

// Example 5: Complex document
const complexExample = document(
  heading(1, 'API Documentation'),
  paragraph('Welcome to our API documentation.'),

  heading(2, 'Authentication'),
  paragraph('To authenticate, you need to include your API key in the header:'),
  codeBlock('Authorization: Bearer YOUR_API_KEY', 'http'),

  heading(2, 'Endpoints'),

  heading(3, 'GET /users'),
  paragraph('Retrieves a list of users.'),

  paragraph('Parameters:'),
  unorderedList(['limit (optional): Maximum number of users to return', 'offset (optional): Number of users to skip']),

  paragraph('Example response:'),
  codeBlock(
    `{
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "total": 1
}`,
    'json',
  ),

  heading(3, 'POST /users'),
  richParagraph([
    'Creates a new user. Send a ',
    inlineCode('POST'),
    ' request to ',
    inlineCode('/users'),
    ' with the user data in the request body.',
  ]),

  paragraph('Required fields:'),
  orderedList(["name: User's full name", 'email: Valid email address']),

  richParagraph([
    'For more information, see our ',
    link('https://api.example.com/docs', 'full API documentation'),
    '.',
  ]),
);

console.log('=== Example 5: Complex Document ===');
console.log(complexExample);
