# Atlas Proposal Generator

This module converts `TreeChange[]` arrays from the diff algorithm into formatted Atlas proposal markdown following the "Process For Preparing Proposals For Atlas Edits" formatting rules.

## Quick Start

```typescript
import { diffTrees } from '../diff/diff-trees';
import { convertTreeChangesToAtlasProposal } from '../services/atlas';

// After running your diff
const changes = diffTrees({
  originalNodeMap,
  duplicateNodeMap,
  originalRoot,
  duplicateRoot,
  originalContentMap,
  duplicateContentMap,
});

// Generate proposal markdown
const proposalMarkdown = convertTreeChangesToAtlasProposal(
  changes,
  {
    originalNodeMap,
    duplicateNodeMap,
    originalRoot,
    duplicateRoot,
    originalContentMap,
    duplicateContentMap,
  },
  {
    includeSubtree: true,
    maxSubtreeDepth: 3,
    groupingStrategy: 'none',
  },
);

console.log(proposalMarkdown);
```

## Features

### ✅ Implemented (MVP)

- **Change Type Handling**: Converts all 4 change types (`added`, `deleted`, `edited`, `moved`)
- **Document References**: Formats as "Portal / GitHub" format with placeholder logic for future differentiation
- **Basic Positioning**: Calculates "directly after/before" relative positioning
- **Content Formatting**: Includes document content with proper indentation
- **Subtree Support**: Configurable inclusion of unchanged children (configurable depth)
- **Proper Markdown**: Generates clean, readable proposal markdown

### 🚧 Placeholder (For Future Implementation)

- **Document Type Detection**: `(Core)`, `(Alignment Artifact)`, etc. annotations
- **Logical Grouping**: Grouping changes by categories or hierarchy
- **Advanced Positioning**: More sophisticated sibling relationship detection

## API Reference

### Main Function

```typescript
function convertTreeChangesToAtlasProposal(
  changes: TreeChange[],
  context: ProposalContext,
  options?: ProposalOptions,
): string;
```

**Parameters:**

- `changes`: Array of changes from `diffTrees()`
- `context`: All tree data needed for context (same data passed to `diffTrees()`)
- `options`: Configuration options (all optional)

**Returns:** Formatted proposal markdown string

### Options

```typescript
interface ProposalOptions {
  includeSubtree?: boolean; // Include unchanged children (default: true)
  maxSubtreeDepth?: number; // Limit subtree depth (default: undefined = no limit)
  groupingStrategy?: 'none' | 'hierarchy' | 'type'; // Grouping strategy (default: 'none')
}
```

### Context

```typescript
interface ProposalContext {
  originalNodeMap: TreeNodeMap;
  duplicateNodeMap: TreeNodeMap;
  originalRoot: TreeNode;
  duplicateRoot: TreeNode;
  originalContentMap: Map<string, string | null>;
  duplicateContentMap: Map<string, string | null>;
}
```

## Output Examples

### Addition

```markdown
- **Add** a new subdocument of `A.1.9.2.2.10 - Bounded External Access Modules (Portal)` / `A.1.9.2.2.10 - Bounded External Access Modules (Github)`. This document should be located directly after `A.1.9.2.2.10.2 - Stability Parameter Bounded External Access Module Exception (Portal)` / `A.1.9.2.2.10.2 - Stability Parameter Bounded External Access Module Exception (Github)` to read as follows:
  - **A.1.9.2.2.10.3 - stUSDS Bounded External Access Module Exception** - The stUSDS Bounded External Access Module (stUSDS BEAM) manages the parameters...
```

### Replacement

```markdown
- **Replace** `A.4.4.1.2.2 - stUSDS Rate (Portal)` / `A.4.4.1.2.2 - stUSDS Rate (Github)` and all of its subdocuments to read as follows:
  - **A.4.4.1.2.2 - stUSDS Rate** - The variable yield earned by stUSDS holders is calculated using the formula
```

### Deletion

```markdown
- **Delete** `A.3.3.2.1.2.2.5.1 - Base Risk (Portal)` / `A.3.3.2.1.2.2.5.1 - Base Risk (Github)`.
```

### Move

```markdown
- **Move** `A.3.3.2.1.2.2.5.2 - Audit Factor (Portal)` / `A.3.3.2.1.2.2.5.2 - Audit Factor (Github)` and its subdocuments to be subdocuments of `A.3.3.2.1.2.2 - Smart Contract Risk Rating Calculation (Portal)` / `A.3.3.2.1.2.2 - Smart Contract Risk Rating Calculation (Github)`. These documents should be located directly after `A.3.3.2.1.2.2.4 - Lindy Adjustment Factor (Portal)` / `A.3.3.2.1.2.2.4 - Lindy Adjustment Factor (Github)` and its subdocuments.
```

## Integration with Existing Codebase

### In `calculate-notion-page-changes.ts`

Add this after your existing `diffTrees` call:

```typescript
// Existing code
const changes = diffTrees({
  originalNodeMap,
  duplicateNodeMap,
  originalRoot,
  duplicateRoot,
  originalContentMap,
  duplicateContentMap,
});

// New: Generate proposal
import { convertTreeChangesToAtlasProposal } from '../services/atlas';

const proposalMarkdown = convertTreeChangesToAtlasProposal(changes, {
  originalNodeMap,
  duplicateNodeMap,
  originalRoot,
  duplicateRoot,
  originalContentMap,
  duplicateContentMap,
}, {
  includeSubtree: true,
  maxSubtreeDepth: 3, // Reasonable depth limit
});

// You can now return or store proposalMarkdown
return {
  changes,
  proposalMarkdown,
  // ... other data
};
```

## Testing

Run the examples:

```bash
# Basic example
npx tsx -e "
import { createMockProposalExample } from './app/server/services/atlas/example-usage';
console.log(createMockProposalExample());
"

# Comprehensive example
npx tsx -e "
import { createComprehensiveTest } from './app/server/services/atlas/comprehensive-test';
console.log(createComprehensiveTest());
"
```

## Future Enhancements

1. **Document Type Detection**: Analyze content/blockType to add `(Core)`, `(Alignment Artifact)` annotations
2. **Logical Grouping**: Group related changes by hierarchy or semantic relationships
3. **Advanced Positioning**: Better sibling relationship detection and positioning rules
4. **Portal/GitHub Differentiation**: When the titles diverge, implement proper mapping logic
5. **Content Analysis**: Smart content summarization for very long proposals
6. **Validation**: Verify proposal syntax against Atlas guidelines

## File Structure

```
/app/server/services/atlas/
├── generate-proposal.ts       # Main conversion logic
├── proposal-formatter.ts      # Formatting utilities
├── proposal-types.ts         # Type definitions
├── example-usage.ts          # Integration examples
├── comprehensive-test.ts     # Full feature test
├── index.ts                  # Exports
└── README.md                 # This file
```
