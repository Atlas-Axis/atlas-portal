# Atlas Document Numbering Rules

This document provides comprehensive rules and logic for generating document numbers for Atlas documents based on their hierarchy and position within the Atlas structure.

## Overview

Atlas document numbers follow a hierarchical numbering system where each document's number is derived from its parent document's number with additional segments appended. The numbering system reflects the document's position in the Atlas hierarchy and its relationship to sibling documents.

## Core Principles

1. **Hierarchical Inheritance**: Document numbers inherit from their parent document's number
2. **Sequential Numbering**: Sibling documents are numbered sequentially starting from 1 (except Scope and Needed Research documents)
3. **Dot Separation**: Number segments are separated by dots (`.`)
4. **Special Directories**: Some document types use special directory numbers (0, 3, 4, 6) for organizational purposes
5. **Global Numbering**: Some document types (Needed Research) use global numbering independent of hierarchy

## Document Type Categories

- **Immutable Documents**: Scopes, Articles, Sections
- **Primary Documents**: Core, Active Data Controller
- **Supporting Documents**: Active Data, Annotation, Needed Research, Action Tenet, Scenario, Scenario Variation
  - Supporting Documents must always have a Target Document, which is an Immutable or Primary Document they attach to (for example, `Active Data` attaches to an `Active Data Controller`). The Target Document can also be referred to as the parent document.

## Document Numbering Rules by Document Type

### 1. Scope Documents

**Pattern**: `A.[Scope Number]`

**Rules**:

- Scopes are top-level documents identified by the prefix `A.`
- Scope numbers increment sequentially starting from 0
- Example: `A.0` (Atlas Preamble), `A.1`, `A.2`, etc.

**Examples**:

- `A.0` - Atlas Preamble
- `A.1` - The Governance Scope
- `A.5` - The Accessibility Scope

### 2. Article Documents

**Pattern**: `[Parent Scope Number].[Article Number]`

**Rules**:

- Articles inherit their parent scope's number
- Article numbers start from 1 and increment sequentially
- Parent: Scope document

**Examples**:

- `A.1.1` - First article under scope A.1
- `A.1.2` - Second article under scope A.1
- `A.2.1` - First article under scope A.2

### 3. Section Documents

**Pattern**: `[Parent Article Number].[Section Number]`

**Rules**:

- Sections inherit their parent article's number
- Section numbers start from 1 and increment sequentially
- Parent: Article document (or another Section for nested sections)

**Examples**:

- `A.1.1.1` - First section under article A.1.1
- `A.1.1.2` - Second section under article A.1.1
- `A.1.2.1` - First section under article A.1.2

### 4. Core Documents (Primary Document sub-type)

**Pattern**: `[Parent Section Number].[Core Number]`

**Rules**:

- Core documents inherit their parent section's number
- Core numbers start from 1 and increment sequentially
- Supports arbitrary levels of nesting
- Parent: Section document (or another Core document for nested Core documents)

**Examples**:

- `A.1.1.2.1` - First core document under section A.1.1.2
- `A.1.1.2.2` - Second core document under section A.1.1.2
- `A.1.1.2.1.1` - Nested core document under core A.1.1.2.1

### 5. Active Data Controller Documents (Primary Document sub-type)

**Pattern**: `[Parent Section Number].[Active Data Controller Number]`

**Rules**:

- Follows the same logic as Core documents
- Active Data Controller numbers start from 1 and increment sequentially
- Parent: Section document

**Examples**:

- `A.1.1.3.1` - First Active Data Controller under section A.1.1.3
- `A.1.1.3.2` - Second Active Data Controller under section A.1.1.3

### 6. Type Specification Documents (Primary Document sub-type)

**Pattern**: `[Parent Section Number].[Type Specification Number]`

**Rules**:

- Follows the same logic as Core documents
- Type Specification numbers start from 1 and increment sequentially
- Parent: Section document

**Examples**:

- `A.1.2.2.2.1` - First Type Specification under section A.1.2.2.2
- `A.1.2.2.2.2` - Second Type Specification under section A.1.2.2.2

### 7. Annotation Documents

**Pattern**: `[Target Document Number].0.3.[Annotation Number]`

**Rules**:

- Annotations target specific documents and inherit their number
- Always append `.0.3.` before the annotation number
- The `0` represents the "Supporting Root" directory
- The `3` represents the "Element Annotation Directory"
- Annotation numbers start from 1 and increment sequentially

**Examples**:

- `A.1.12.1.2.0.3.1` - First annotation targeting document A.1.12.1.2
- `A.1.12.1.2.0.3.2` - Second annotation targeting document A.1.12.1.2

### 8. Tenet Documents

**Pattern**: `[Target Document Number].0.4.[Tenet Number]`

**Rules**:

- Tenets target specific documents and inherit their number
- Always append `.0.4.` before the tenet number
- The `0` represents the "Supporting Root" directory
- The `4` represents the "Facilitator Tenet Annotation Directory"
- Tenet numbers start from 1 and increment sequentially

**Examples**:

- `A.1.4.5.0.4.1` - First tenet targeting document A.1.4.5
- `A.1.4.5.0.4.2` - Second tenet targeting document A.1.4.5

### 9. Scenario Documents

**Pattern**: `[Parent Tenet Number].1.[Scenario Number]`

**Rules**:

- Scenarios inherit their parent tenet's number
- Always append `.1.` before the scenario number
- The `1` represents the "Facilitator Scenario Directory"
- Scenario numbers start from 1 and increment sequentially
- Parent: Tenet document

**Examples**:

- `A.1.4.5.0.4.1.1.1` - First scenario under tenet A.1.4.5.0.4.1
- `A.1.4.5.0.4.1.1.2` - Second scenario under tenet A.1.4.5.0.4.1

### 10. Scenario Variation Documents

**Pattern**: `[Parent Scenario Number].var[Variation Number]`

**Rules**:

- Scenario Variations inherit their parent scenario's number
- Always append `.var` before the variation number
- Variation numbers start from 1 and increment sequentially
- Parent: Scenario document

**Examples**:

- `A.1.4.5.0.4.1.1.1.var1` - First variation of scenario A.1.4.5.0.4.1.1.1
- `A.1.4.5.0.4.1.1.1.var2` - Second variation of scenario A.1.4.5.0.4.1.1.1

### 11. Active Data Documents

**Pattern**: `[Parent Active Data Controller Number].0.6.[Active Data Number]`

**Rules**:

- Active Data documents inherit their parent Active Data Controller's number
- Always append `.0.6.` before the active data number
- The `0` represents the "Supporting Root" directory
- The `6` represents the "Active Data Directory"
- Active Data numbers start from 1 and increment sequentially
- Parent: Active Data Controller document

**Examples**:

- `A.1.1.3.1.0.6.1` - First active data under controller A.1.1.3.1
- `A.1.1.3.1.0.6.2` - Second active data under controller A.1.1.3.1

### 12. Needed Research Documents

**Pattern**: `NR-[Needed Research Number]`

**Rules**:

- Needed Research documents use global numbering independent of hierarchy
- Always use the prefix `NR-` followed by a sequential number
- Numbers start from 1 and increment globally across all Needed Research documents
- No parent-child relationship affects numbering

**Examples**:

- `NR-1` - First needed research item
- `NR-5` - Fifth needed research item
- `NR-10` - Tenth needed research item

## Special Directory Numbers

The numbering system uses special directory numbers for organizational purposes:

- **0** - Supporting Root directory
- **1** - Facilitator Scenario Directory
- **3** - Element Annotation Directory
- **4** - Facilitator Tenet Annotation Directory
- **6** - Active Data Directory

## Implementation Guidelines

### For AI Agents

When implementing document numbering logic:

1. **Identify Parent Document**: Determine the parent document and its number
2. **Apply Type-Specific Rules**: Use the appropriate pattern for the document type
3. **Handle Sequential Numbering**: Ensure sibling documents are numbered sequentially
4. **Respect Special Directories**: Use the correct directory numbers for supporting documents
5. **Validate Hierarchy**: Ensure the document fits within the Atlas hierarchy structure

### Common Patterns

- **Hierarchical Documents**: Most documents inherit their parent's number and append their own segment
- **Supporting Documents**: Use special directory numbers (0.3, 0.4, 0.6) for organizational purposes
- **Global Documents**: Needed Research uses global numbering independent of hierarchy
- **Nested Documents**: Some document types support arbitrary levels of nesting

### Edge Cases

- **Empty Parent Numbers**: Some documents may not have parent numbers (e.g., top-level scopes)
- **Multiple Parents**: Some documents may reference multiple parent documents
- **Orphaned Documents**: Documents without clear parent relationships
- **Circular References**: Ensure no circular parent-child relationships exist

## Examples by Hierarchy Level

### Level 1: Scopes

- `A.0` - Atlas Preamble
- `A.1` - First scope
- `A.2` - Second scope

### Level 2: Articles

- `A.1.1` - First article under A.1
- `A.1.2` - Second article under A.1
- `A.2.1` - First article under A.2

### Level 3: Sections

- `A.1.1.1` - First section under A.1.1
- `A.1.1.2` - Second section under A.1.1
- `A.1.2.1` - First section under A.1.2

### Level 4: Primary Documents

- `A.1.1.1.1` - First core document under A.1.1.1
- `A.1.1.2.1` - First core document under A.1.1.2
- `A.1.1.3.1` - First Active Data Controller under A.1.1.3

### Supporting Documents

- `A.1.1.1.0.3.1` - First annotation targeting A.1.1.1
- `A.1.1.1.0.4.1` - First tenet targeting A.1.1.1
- `A.1.1.3.1.0.6.1` - First active data under controller A.1.1.3.1

### Scenario Documents

- `A.1.1.1.0.4.1.1.1` - First scenario under tenet A.1.1.1.0.4.1
- `A.1.1.1.0.4.1.1.1.var1` - First variation of scenario A.1.1.1.0.4.1.1.1

### Global Documents

- `NR-1` - First needed research item
- `NR-5` - Fifth needed research item

## Validation Rules

When validating document numbers:

1. **Format Validation**: Ensure the number follows the correct pattern for its type
2. **Hierarchy Validation**: Verify the document fits within the Atlas hierarchy
3. **Uniqueness Validation**: Ensure no duplicate numbers exist
4. **Parent Validation**: Verify parent documents exist and are valid
5. **Sequential Validation**: Ensure sibling documents are numbered sequentially

This numbering system ensures that every Atlas document has a unique, hierarchical identifier that reflects its position and relationships within the Atlas structure.

## Atlas Document Hierarchy

The Atlas documents are organized in a hierarchical structure across multiple Notion databases. The hierarchy defines the relationships between different types of documents:

```
Scopes
├── Articles
│   ├── Sections & Primary Docs
│   │   ├── Annotations
│   │   └── Tenets
│   │       ├── Scenarios
│   │       └── Scenario Variations
├── Agent Scope Database
│   ├── Annotations
│   ├── Tenets
│   │   ├── Scenarios
│   │   └── Scenario Variations
│   └── Active Data
└── Needed Research
```

**Internal Nesting**: Some Notion databases support internal hierarchy where documents can be nested under other documents of the same type:

- **Sections & Primary Docs** - Can have multiple levels of internal nesting
- **Agent Scope Database** - Can have multiple levels of internal nesting

This hierarchical structure is implemented in the `ATLAS_DATABASES` constant and managed through the `notion-database-properties-and-relationships.ts` mapping system.

## Atlas Database to Atlas Document Type Mapping

Each Atlas database contains specific types of documents. Here's the mapping of database names to their possible document types:

- **Scopes**
  - Scope

- **Articles**
  - Article

- **Sections & Primary Docs**
  - Section
  - Core
  - Type Specification
  - Active Data Controller

- **Annotations**
  - Annotation

- **Tenets**
  - Action Tenet

- **Scenarios**
  - Scenario

- **Scenario Variations**
  - Scenario Variation

- **Active Data**
  - Active Data

- **Agent Scope Database**
  - Core
  - Active Data Controller

- **Needed Research**
  - Needed Research
