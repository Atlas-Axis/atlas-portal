# Markdown Generator Examples for AI Agents

This document provides practical examples that AI agents can use as templates for generating markdown content.

## Example 1: API Documentation

```typescript
import {
  bold,
  codeBlock,
  document,
  heading,
  inlineCode,
  paragraph,
  richParagraph,
  unorderedList,
} from '@/app/server/markdown';

function generateApiDocs(apiName: string, endpoints: ApiEndpoint[]) {
  return document(
    heading(1, `${apiName} API Documentation`),
    paragraph('This document describes the available API endpoints and their usage.'),

    heading(2, 'Authentication'),
    richParagraph([
      'All API requests require authentication using a Bearer token in the ',
      inlineCode('Authorization'),
      ' header:',
    ]),
    codeBlock('Authorization: Bearer YOUR_API_TOKEN', 'http'),

    heading(2, 'Endpoints'),
    ...endpoints.flatMap((endpoint) => [
      heading(3, `${endpoint.method} ${endpoint.path}`),
      paragraph(endpoint.description),

      ...(endpoint.parameters
        ? [
            paragraph('**Parameters:**'),
            unorderedList(
              endpoint.parameters.map(
                (p) => `${bold(p.name)} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`,
              ),
            ),
          ]
        : []),

      ...(endpoint.example
        ? [
            paragraph('**Example Request:**'),
            codeBlock(endpoint.example.request, 'bash'),
            paragraph('**Example Response:**'),
            codeBlock(endpoint.example.response, 'json'),
          ]
        : []),
    ]),
  );
}

// Usage
const endpoints = [
  {
    method: 'GET',
    path: '/api/users',
    description: 'Retrieve a list of users',
    parameters: [
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of users to return' },
      { name: 'offset', type: 'number', required: false, description: 'Number of users to skip' },
    ],
    example: {
      request: 'curl -H "Authorization: Bearer token" https://api.example.com/users?limit=10',
      response: JSON.stringify({ users: [{ id: 1, name: 'John' }], total: 1 }, null, 2),
    },
  },
];

const apiDocs = generateApiDocs('User Management', endpoints);
```

## Example 2: Release Notes / Changelog

```typescript
function generateReleaseNotes(version: string, releaseData: ReleaseData) {
  return document(
    heading(1, `Release ${version}`),
    paragraph(`Released on ${releaseData.date}`),

    ...(releaseData.highlights ? [heading(2, 'Highlights'), unorderedList(releaseData.highlights)] : []),

    ...(releaseData.breaking?.length
      ? [
          heading(2, '🚨 Breaking Changes'),
          unorderedList(releaseData.breaking.map((change) => `**${change.component}**: ${change.description}`)),
        ]
      : []),

    ...(releaseData.features?.length ? [heading(2, '✨ New Features'), unorderedList(releaseData.features)] : []),

    ...(releaseData.improvements?.length
      ? [heading(2, '🔧 Improvements'), unorderedList(releaseData.improvements)]
      : []),

    ...(releaseData.bugFixes?.length ? [heading(2, '🐛 Bug Fixes'), unorderedList(releaseData.bugFixes)] : []),

    ...(releaseData.migration
      ? [
          heading(2, 'Migration Guide'),
          paragraph(releaseData.migration.description),
          ...(releaseData.migration.steps ? [orderedList(releaseData.migration.steps)] : []),
          ...(releaseData.migration.codeExample
            ? [paragraph('**Example:**'), codeBlock(releaseData.migration.codeExample, 'typescript')]
            : []),
        ]
      : []),
  );
}
```

## Example 3: Tutorial / How-to Guide

```typescript
function generateTutorial(title: string, steps: TutorialStep[]) {
  return document(
    heading(1, title),
    paragraph('This tutorial will guide you through the process step by step.'),

    heading(2, 'Prerequisites'),
    unorderedList(['Node.js 18 or higher', 'Basic knowledge of TypeScript', 'A text editor or IDE']),

    ...steps.flatMap((step, index) => [
      heading(2, `Step ${index + 1}: ${step.title}`),
      paragraph(step.description),

      ...(step.code ? [codeBlock(step.code, step.language || 'bash')] : []),

      ...(step.notes ? [richParagraph([bold('Note: '), step.notes])] : []),

      ...(step.tips?.length ? [paragraph('💡 **Tips:**'), unorderedList(step.tips)] : []),
    ]),

    heading(2, 'Next Steps'),
    paragraph("Congratulations! You've completed the tutorial."),
    unorderedList([
      'Explore the advanced features',
      'Check out the API documentation',
      'Join our community for support',
    ]),
  );
}
```

## Example 4: Project README

```typescript
function generateProjectReadme(project: ProjectInfo) {
  return document(
    heading(1, project.name),
    paragraph(project.description),

    ...(project.badges?.length
      ? [paragraph(project.badges.map((badge) => `![${badge.alt}](${badge.url})`).join(' '))]
      : []),

    heading(2, 'Features'),
    unorderedList(project.features),

    heading(2, 'Installation'),
    codeBlock(project.installation, 'bash'),

    heading(2, 'Quick Start'),
    paragraph("Here's how to get started:"),
    codeBlock(project.quickStart, project.language),

    ...(project.examples?.length
      ? [
          heading(2, 'Examples'),
          ...project.examples.flatMap((example) => [
            heading(3, example.title),
            paragraph(example.description),
            codeBlock(example.code, example.language),
          ]),
        ]
      : []),

    heading(2, 'Configuration'),
    paragraph('You can configure the project using the following options:'),
    codeBlock(JSON.stringify(project.defaultConfig, null, 2), 'json'),

    heading(2, 'Contributing'),
    orderedList([
      'Fork the repository',
      'Create your feature branch',
      'Commit your changes',
      'Push to the branch',
      'Create a Pull Request',
    ]),

    heading(2, 'License'),
    paragraph(`This project is licensed under the ${project.license} License.`),
  );
}
```

## Example 5: Error Documentation

```typescript
function generateErrorDocs(errors: ErrorInfo[]) {
  return document(
    heading(1, 'Error Reference'),
    paragraph('This document lists all possible errors and their solutions.'),

    ...errors
      .map((error) => [
        heading(2, `${error.code}: ${error.name}`),
        paragraph(error.description),

        heading(3, 'Cause'),
        paragraph(error.cause),

        heading(3, 'Solution'),
        ...(typeof error.solution === 'string' ? [paragraph(error.solution)] : [orderedList(error.solution)]),

        ...(error.example
          ? [
              heading(3, 'Example'),
              codeBlock(error.example.code, error.example.language),
              ...(error.example.fix
                ? [paragraph('**Fix:**'), codeBlock(error.example.fix, error.example.language)]
                : []),
            ]
          : []),
      ])
      .flat(),
  );
}
```

## Example 6: Data Report

```typescript
function generateDataReport(title: string, data: ReportData) {
  return document(
    heading(1, title),
    paragraph(`Report generated on ${new Date().toLocaleDateString()}`),

    heading(2, 'Summary'),
    unorderedList([
      `Total records: ${data.totalRecords}`,
      `Success rate: ${data.successRate}%`,
      `Processing time: ${data.processingTime}ms`,
    ]),

    ...(data.metrics
      ? [
          heading(2, 'Metrics'),
          ...Object.entries(data.metrics).map(([key, value]) => paragraph(`**${key}**: ${value}`)),
        ]
      : []),

    ...(data.errors?.length
      ? [
          heading(2, 'Errors'),
          unorderedList(data.errors.map((error) => `${error.type}: ${error.message} (${error.count} occurrences)`)),
        ]
      : []),

    ...(data.recommendations?.length ? [heading(2, 'Recommendations'), orderedList(data.recommendations)] : []),
  );
}
```

## Best Practices for AI Agents

### 1. Structure Planning

Always plan the document structure before generating content:

```typescript
// Good: Plan the structure
const sections = [
  { type: 'heading', level: 1, content: title },
  { type: 'intro', content: description },
  { type: 'features', items: features },
  { type: 'examples', items: examples },
];

const doc = generateFromStructure(sections);
```

### 2. Conditional Content

Handle optional sections gracefully:

```typescript
// Good: Use conditional spreads
document(
  heading(1, title),
  ...(hasIntro ? [paragraph(intro)] : []),
  ...(features?.length ? [heading(2, 'Features'), unorderedList(features)] : []),
);
```

### 3. Data Validation

Validate data before generating markdown:

```typescript
function generateSafeMarkdown(data: unknown) {
  // Validate and sanitize data first
  const validated = validateData(data);
  if (!validated.success) {
    return paragraph('Error: Invalid data provided');
  }

  return generateMarkdown(validated.data);
}
```

### 4. Reusable Components

Create reusable functions for common patterns:

```typescript
function createSection(title: string, items: string[]) {
  return [heading(2, title), unorderedList(items)];
}

// Usage
document(heading(1, 'Main Title'), ...createSection('Features', features), ...createSection('Benefits', benefits));
```
