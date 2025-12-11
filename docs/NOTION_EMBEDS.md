# Embedded Content Support in Notion

> **⚠️ DEPRECATED - REFERENCE ONLY**
>
> This documentation relates to **obsolete embedded page features** (Edit Page generation) that are no longer maintained. The embed compatibility information is kept for historical reference only. These features will need to be reimplemented in the future if embeds are needed again.

## Overview

The project includes embeddable pages under the `/embed` route that were designed to be embedded as iframes within Notion pages. These embeds provided interactive UIs for edit page workflows directly within the Notion editing environment.

## Embed Types

The codebase contains two main types of embeds:

### 1. Create Edit Page Embed

**Route**: `/embed/create-edit-page/[notion-page-id]`

**Purpose**: Allows users to create a duplicate "Edit Page" from an original Atlas document page in Notion.

**Features**:

- Fetches the original page title from Notion API
- Provides an action button to trigger edit page creation
- Handles errors gracefully with user-friendly error messages

### 2. Diff Viewer Embed

**Route**: `/embed/diff/[edit-page-id]`

**Purpose**: Displays a visual diff showing changes between the original page and the edited version.

**Features**:

- Calculates hierarchical changes using tree diffing algorithms
- Shows a structured change list with context
- Renders markdown proposals as HTML for easy review
- Includes debug views showing raw markdown source and change data

**Variants**:

- `/embed/diff/[edit-page-id]` - Default view with change list and markdown output
- `/embed/diff/[edit-page-id]/markdown` - Markdown-focused view
- `/embed/diff/[edit-page-id]/modern` - Modern UI variant

## Technical Implementation

**Layout**: All embed pages use a custom layout (`app/embed/layout.tsx`) with a centered, card-style design (max-width, rounded borders, gray background) optimized for iframe embedding.

**Server Components**: Embed pages are primarily Server Components that fetch data from Notion API and Supabase, with client components used only for interactive elements (buttons, actions).

**UUID Handling**: Supports both hyphenated and non-hyphenated UUID formats in URLs, automatically normalizing them as needed.

## Platform Compatibility

- ✅ MacOS web browser ([notion.so](https://www.notion.so/))
- ✅ MacOS Notion app
- ✅ iPhone/iPad web browser ([notion.so](https://www.notion.so/))
- 🚫 iPhone/iPad Notion app - Doesn't show embedded iframes

**Note**: The iOS/iPad Notion app does not support iframe embeds, so users on those platforms must use the web browser version of Notion to access embedded functionality.
