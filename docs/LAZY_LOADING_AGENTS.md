# Lazy Loading Agent Scope Database to Reduce ISR Size

## Problem

Both `/atlas` and `/atlas/list` pages exceeded Vercel's 19.07 MB ISR size limit (25.42 MB actual) when including the Agent Scope Database during static generation, causing `FALLBACK_BODY_TOO_LARGE` build failures.

## Solution

Exclude Agent Scope Database from static prerendering and lazy load it client-side via API endpoint.

### Architecture Flow

1. **Server (ISR)**: Load and render all Atlas data **except** agents
2. **API Route**: Cached endpoint (`/api/atlas/agents`) serves agent data
3. **Client**: Fetch agents after initial render and merge into tree

---

## Implementation Overview

### `/atlas/list` Page (Flat List View)

**Files:**

- `app/atlas/list/page.tsx` - Server component, passes `excludeAgents: true` to loader
- `app/atlas/list/atlas-list-prerendered.tsx` - Client wrapper, manages state
- `app/atlas/list/agents-section-loader.tsx` - Fetches agents, updates state

**Merge Strategy:** Simple array append to state dictionary

### `/atlas` Page (Hierarchical Tree View)

**Files:**

- `app/atlas/page.tsx` - Server component, passes `excludeAgents: true` to loader
- `app/atlas/atlas-page-prerendered.tsx` - Client wrapper, manages tree state
- `app/atlas/agents-scope-loader.tsx` - Fetches agents, rebuilds entire tree

**Merge Strategy:** Flatten initial tree → add agents → rebuild complete tree

### Shared API Endpoint

**File:** `app/api/atlas/agents/route.ts`

- Loads agent data from Supabase
- Returns flattened agent nodes as JSON
- 60-second cache (`revalidate = 60`)

---

## Key Differences

| Aspect              | `/atlas/list`                               | `/atlas`                                                |
| ------------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Data Structure**  | Flat list per database                      | Hierarchical tree                                       |
| **Loader Function** | `loadAtlasFromSupabase...WithoutNesting...` | `loadAtlasFromSupabase...WithNestingAgentsUnderSection` |
| **Merge Strategy**  | Simple array append                         | Full tree rebuild with flattening                       |
| **Nesting Logic**   | Not needed                                  | Agents nested under specific section                    |
| **Loading UI**      | Text in content area                        | Fixed bottom-right indicator                            |

---

## Performance

### Benefits

- ISR size reduced from 25.42 MB to under 19 MB
- Immediate initial page render
- API response cached for 60 seconds
- Progressive enhancement

### Trade-offs

- Client-side tree rebuilding for `/atlas`
- Minor layout shift when agents load
- Tree building logic runs server and client-side

---

## Future Optimizations

- React Server Components streaming - Caching the data only, not the HTML
- Incremental/batch loading
- Service worker caching
- `<link rel="preload">` for API call
- Virtual scrolling for large lists
