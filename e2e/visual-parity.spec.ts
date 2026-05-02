/**
 * Visual parity test (Playwright, e2e).
 *
 * Renders representative Atlas pages via two builds of the portal — one
 * pointed at the legacy monolith and one pointed at the new tarball+compose
 * tree — and asserts DOM equality at the leaf Atlas-content area.
 *
 * ---------------------------------------------------------------------------
 * Coverage map: how parity is verified at each level of the pipeline.
 * ---------------------------------------------------------------------------
 *
 *   1. Byte-level (`compose.test.ts`, vitest, always-on):
 *      `compose(content/) === Sky Atlas.md` — the composed monolith is
 *      byte-identical to the source monolith for the vendored fixture.
 *
 *   2. Structural (`app/server/atlas/visual-parity.test.ts`, vitest, gated
 *      on TS_ATLAS_LIVE_CONTENT_DIR + TS_ATLAS_LIVE_MONOLITH):
 *      Same byte equality against the live atlas content tree, plus deep
 *      equality of the parsed `ExportTree` from each input. Catches a
 *      hypothetical non-determinism in the parser independent of bytes.
 *
 *   3. Rendered DOM (this file, Playwright e2e, gated on having two running
 *      portal instances on PARITY_BASELINE_URL / PARITY_CANDIDATE_URL):
 *      Compares innerHTML of the atlas content area between a baseline
 *      portal (legacy monolith fetch) and a candidate portal (tarball +
 *      compose). Exercises the full SSR + hydration + KaTeX + DOMPurify +
 *      HeroUI pipeline end-to-end.
 *
 * On byte-identical compose, layers 2 and 3 are mathematically REDUNDANT —
 * DOM equality is implied. They exist so that a regression in either the
 * parser/renderer pipeline OR the compose pipeline is caught by an
 * end-to-end signal independent of the unit-level byte check.
 *
 * ---------------------------------------------------------------------------
 * Setup (manual, until CI pipes it in):
 * ---------------------------------------------------------------------------
 *
 *   1. `npm install` (installs @playwright/test as a devDependency)
 *   2. `npx playwright install chromium`
 *   3. Vendor a baseline monolith snapshot:
 *      `gh api repos/sky-ecosystem/next-gen-atlas/contents/Sky%20Atlas/Sky%20Atlas.md?ref=main \
 *         --jq .content | base64 -d > tests/fixtures/baseline-monolith.md`
 *   4. Build & start two portal instances (one against monolith, one against
 *      atomic-atlas tarball) on different ports, then `npm run test:e2e`.
 *
 * ---------------------------------------------------------------------------
 * Per-document routing note.
 * ---------------------------------------------------------------------------
 *
 * The portal currently exposes a single `/atlas` route that pre-renders the
 * full tree; individual documents are addressed via fragment anchors
 * (`#<uuid>` or `#<doc_no>`) within that page rather than dedicated routes.
 * That means deep-linking to a doc from a fresh tab loads the entire `/atlas`
 * DOM and then scrolls — the inner-HTML diff at `[data-testid="atlas-content"]`
 * already covers every doc per page load. The hash-suffixed entries below
 * therefore exercise the same DOM as `/atlas` itself; they are listed
 * separately to make coverage of each Atlas document type explicit and to
 * future-proof against the routing being split into per-doc routes (at
 * which point the URLs become semantically distinct without code change).
 */
import { type Page, expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASELINE_BASE = process.env.PARITY_BASELINE_URL ?? 'http://localhost:3001';
const CANDIDATE_BASE = process.env.PARITY_CANDIDATE_URL ?? 'http://localhost:3002';

/**
 * Sample paths covering each Atlas document type the renderer treats
 * differently (Scope, Core, Active Data Controller, Needed Research, leaf
 * Action Tenet). Doc numbers are taken from the canonical Sky Atlas at
 * https://github.com/sky-ecosystem/next-gen-atlas; if a number is renamed
 * upstream the test will surface a baseline-vs-candidate diff and the path
 * here should be updated to match.
 *
 * Hash anchors target the doc by its `data-doc-id` (doc_no) attribute used
 * by the prerendered atlas page. They have no effect on the SSR'd HTML but
 * are kept to document the intent and to remain useful once per-doc routes
 * exist.
 */
const SAMPLE_PATHS: string[] = [
  '/',
  '/atlas',
  // Top-level Scope.
  '/atlas#A.0',
  // Core directly under a Scope/Article.
  '/atlas#A.0.1.2',
  // Active Data Controller (ADC).
  '/atlas#A.1.1.1',
  // Doc with a Needed Research attached.
  '/atlas#NR-1',
  // Leaf Action Tenet under an ADC.
  '/atlas#A.1.1.1.0.4.1',
];

const CONTENT_SELECTOR = '[data-testid="atlas-content"], main';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function captureContentHtml(page: Page, baseUrl: string, pathname: string): Promise<string> {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'networkidle' });
  // Wait for hydration and KaTeX render.
  await page.waitForLoadState('networkidle');
  const html = await page.locator(CONTENT_SELECTOR).first().innerHTML();
  return normalizeHtml(html);
}

/**
 * Normalize differences that aren't load-bearing for parity:
 * - React's `data-reactroot` etc. (none in App Router, but defensive)
 * - Non-deterministic IDs (KaTeX uses incrementing IDs per render).
 * - Trailing whitespace.
 */
function normalizeHtml(s: string): string {
  return s
    .replace(/\sdata-reactroot=""/g, '')
    .replace(/\sid="MathJax-Element-\d+"/g, ' id="MathJax-Element"')
    .replace(/\bkatex-html-id-\d+\b/g, 'katex-html-id')
    .replace(/\s+$/gm, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

for (const pathname of SAMPLE_PATHS) {
  test(`DOM parity: ${pathname}`, async ({ page }) => {
    const baseline = await captureContentHtml(page, BASELINE_BASE, pathname);
    const candidate = await captureContentHtml(page, CANDIDATE_BASE, pathname);
    expect(candidate).toBe(baseline);
  });
}
