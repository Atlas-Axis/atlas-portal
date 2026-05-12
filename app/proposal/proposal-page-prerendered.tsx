import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import type { ProposalData } from '@/app/server/proposal/load-proposal-data';
import type { Scope, ScopeNode } from '@/app/server/proposal/scope-data';

interface ProposalPagePrerenderedProps {
  data: ProposalData;
}

/**
 * Render one document node within a scope tree.
 *
 * scope_data carries:
 *   - status === null: unchanged context doc (compact heading, no body)
 *   - status === 'Edited' | 'Inserted' | 'Deleted': render the diff body
 *
 * The Python renderer has already produced both `compareHtml` (diff
 * highlighting via `<span class="diff-add" / "diff-del">`) and
 * `finalHtml`. We render `compareHtml` for everything inside a scope
 * (so unchanged children of an edited parent still appear as context),
 * which keeps the visual hierarchy continuous.
 */
function renderNode(node: ScopeNode, depth: number): React.ReactNode {
  const isChanged = node.status !== null;
  const statusClass = node.status
    ? node.status === 'Edited'
      ? 'status-edited'
      : node.status === 'Inserted'
        ? 'status-inserted'
        : 'status-deleted'
    : 'status-context';

  const titleHtml = node.titleDiff ?? null;

  // Cap nesting indent — Atlas docs can be 6+ levels deep but the
  // visual indent has diminishing returns past 4.
  const indent = Math.min(depth, 4);

  return (
    <div
      key={`${node.id}-${node.uuid}`}
      data-testid="proposal-doc"
      data-doc-no={node.id}
      data-doc-uuid={node.uuid}
      data-status={node.status ?? 'context'}
      className={`proposal-doc ${node.compact ? 'compact' : ''} ${statusClass}`}
      style={{ marginLeft: `${indent * 12}px` }}
    >
      <header className="proposal-doc-head">
        {isChanged && <span className={`proposal-doc-badge ${statusClass}`}>{node.status}</span>}
        <span className="proposal-doc-id">{node.id}</span>
        {titleHtml ? (
          <h3 className="proposal-doc-title" dangerouslySetInnerHTML={{ __html: titleHtml }} />
        ) : (
          <h3 className="proposal-doc-title">{node.title}</h3>
        )}
      </header>
      {isChanged && node.compareHtml && (
        <div className="proposal-doc-body" dangerouslySetInnerHTML={{ __html: node.compareHtml }} />
      )}
      {node.children.map((child) => renderNode(child, depth + 1))}
    </div>
  );
}

/**
 * Render one scope = one independent edit subtree.
 */
function renderScope(slug: string, scope: Scope): React.ReactNode {
  return (
    <article key={slug} id={slug} data-testid="proposal-scope" data-scope-slug={slug} className="proposal-scope">
      <header className="proposal-scope-head">
        <p className="proposal-scope-eyebrow">Edit scope</p>
        <h2 className="proposal-scope-title">
          {scope.label}
          {scope.labelDetail && <span className="proposal-scope-label-detail"> / {scope.labelDetail}</span>}
        </h2>
        <p className="proposal-scope-summary">{scope.summaryCompare}</p>
        {scope.lineage.length > 0 && (
          <nav className="proposal-scope-lineage" aria-label="Document ancestors">
            {scope.lineage.map((anc) => (
              <span key={anc.uuid} className="proposal-scope-lineage-item">
                {anc.id} — {anc.title}
              </span>
            ))}
          </nav>
        )}
      </header>
      <div className="proposal-scope-body">{renderNode(scope.root, 0)}</div>
    </article>
  );
}

/**
 * Server-rendered proposal viewer.
 *
 * Consumes the Python renderer's scope_data JSON: each scope is an
 * independent edit subtree with a root document and its changed
 * descendants. Per-document diff HTML is produced by the Python renderer
 * (with diff-add / diff-del spans); this component wraps it with scope
 * headers, doc titles, and CSS.
 *
 * No client-side scripting — the page is fully static at build time.
 */
export default function ProposalPagePrerendered({ data }: ProposalPagePrerenderedProps) {
  const { proposal, scopeData, summaryMarkdown } = data;
  const summaryHtml = summaryMarkdown ? markdownToHTML(summaryMarkdown) : '';

  const scopeEntries = Object.entries(scopeData.scopes);
  const { stats } = scopeData;

  return (
    <div className="min-h-screen bg-white px-4 py-10 text-zinc-900 sm:px-8 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-700">
          <p className="mb-1 text-sm tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Atlas Edit Proposal · PR #{proposal.prNumber}
          </p>
          <h1 className="text-3xl font-semibold">{proposal.title}</h1>
          {stats.total > 0 && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {stats.total} document{stats.total === 1 ? '' : 's'} changed
              {(stats.modified > 0 || stats.new > 0 || stats.removed > 0) && (
                <>
                  {' '}
                  <span className="text-zinc-400 dark:text-zinc-500">·</span>{' '}
                  {stats.modified > 0 && (
                    <>
                      <span className="text-amber-700 dark:text-amber-300">{stats.modified} edited</span>
                      {(stats.new > 0 || stats.removed > 0 || stats.renumbered > 0) && <>, </>}
                    </>
                  )}
                  {stats.new > 0 && (
                    <>
                      <span className="text-emerald-700 dark:text-emerald-300">{stats.new} new</span>
                      {(stats.removed > 0 || stats.renumbered > 0) && <>, </>}
                    </>
                  )}
                  {stats.removed > 0 && (
                    <>
                      <span className="text-rose-700 dark:text-rose-300">{stats.removed} removed</span>
                      {stats.renumbered > 0 && <>, </>}
                    </>
                  )}
                  {stats.renumbered > 0 && (
                    <span className="text-zinc-600 dark:text-zinc-400">{stats.renumbered} renumbered</span>
                  )}
                </>
              )}
            </p>
          )}
        </header>

        {summaryHtml ? (
          <section className="prose prose-zinc dark:prose-invert mb-12 max-w-none">
            <h2 className="text-xl font-semibold">Summary</h2>
            <div
              data-testid="proposal-summary"
              className="proposal-summary"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          </section>
        ) : (
          <section className="mb-12">
            <h2 className="text-xl font-semibold">Summary</h2>
            <p className="text-zinc-500 dark:text-zinc-400">No summary provided.</p>
          </section>
        )}

        <hr className="my-8 border-zinc-200 dark:border-zinc-700" />

        <section data-testid="proposal-diff" className="proposal-diff">
          <h2 className="mb-6 text-xl font-semibold">Document Changes</h2>
          {scopeEntries.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">No document changes detected.</p>
          ) : (
            <div className="space-y-12">{scopeEntries.map(([slug, scope]) => renderScope(slug, scope))}</div>
          )}
        </section>

        {scopeData.renumbered.length > 0 && (
          <section data-testid="proposal-renumbered" className="proposal-renumbered mt-12">
            <hr className="my-8 border-zinc-200 dark:border-zinc-700" />
            <h2 className="mb-3 text-xl font-semibold">Renumbered Documents</h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              These documents had their identifier changed without modifying their content. Listed for audit; not shown
              in the Document Changes section above.
            </p>
            <ul className="space-y-1 text-sm">
              {scopeData.renumbered.map((r) => (
                <li key={`${r.oldId}-${r.newId}`} className="flex flex-wrap gap-x-2">
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">{r.oldId}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">→</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-200">{r.newId}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">·</span>
                  <span className="text-zinc-700 dark:text-zinc-200">{r.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <style>{proposalDiffCss}</style>
      <script dangerouslySetInnerHTML={{ __html: crossRefScript }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client-side cross-reference routing.
//
// The Python renderer emits every UUID cross-reference as
// <a href="https://sky-atlas.io/#<uuid>" target="_blank" data-xref-uuid="<uuid>">.
// That's the right behavior for cross-references whose target is NOT in
// this proposal — clicking opens the Atlas viewer in a new tab.
//
// When the target IS in this proposal, that behavior is wrong — we should
// scroll to the doc on the same page (where the diff is rendered) instead
// of opening the Atlas viewer, which would show the pre-proposal version.
//
// This script runs at page load, walks every cross-reference link, and
// rewrites the in-proposal ones to an in-page scroll handler.
// ---------------------------------------------------------------------------

const crossRefScript = `
(function () {
  function run() {
    var docNodes = document.querySelectorAll('[data-doc-uuid]');
    if (!docNodes.length) return;
    var inProposal = new Set();
    for (var i = 0; i < docNodes.length; i++) {
      var u = docNodes[i].getAttribute('data-doc-uuid');
      if (u) inProposal.add(u);
    }
    var links = document.querySelectorAll('.proposal-doc-body a[data-xref-uuid]');
    for (var j = 0; j < links.length; j++) {
      var link = links[j];
      var uuid = link.getAttribute('data-xref-uuid');
      if (!uuid || !inProposal.has(uuid)) continue;
      link.setAttribute('href', '#' + uuid);
      link.removeAttribute('target');
      link.removeAttribute('rel');
      link.style.cursor = 'pointer';
      link.addEventListener('click', function (uuidVal) {
        return function (e) {
          e.preventDefault();
          var target = document.querySelector('[data-doc-uuid="' + uuidVal.replace(/"/g, '\\\\"') + '"]');
          if (!target) return;
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var prevShadow = target.style.boxShadow;
          var prevTransition = target.style.transition;
          target.style.transition = 'box-shadow 0.3s';
          target.style.boxShadow = '0 0 0 2px rgb(245 158 11 / 0.7)';
          setTimeout(function () {
            target.style.boxShadow = prevShadow;
            setTimeout(function () { target.style.transition = prevTransition; }, 400);
          }, 1200);
        };
      }(uuid));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
`;

// ---------------------------------------------------------------------------
// Scoped CSS for the proposal diff view.
//
// The Python renderer emits diff highlights as <span class="diff-add"> and
// <span class="diff-del">. The rest of the markup is structural — we
// style it here to match atlas-portal's design language.
// ---------------------------------------------------------------------------

const proposalDiffCss = `
  .proposal-diff { font-size: 15px; line-height: 1.6; }

  .proposal-scope {
    border-radius: 10px;
    border: 1px solid rgba(16, 24, 40, 0.10);
    background: white;
    padding: 24px;
  }
  :is(.dark) .proposal-scope {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .proposal-scope-head { margin-bottom: 20px; border-bottom: 1px solid rgba(16, 24, 40, 0.06); padding-bottom: 14px; }
  :is(.dark) .proposal-scope-head { border-bottom-color: rgba(255, 255, 255, 0.06); }
  .proposal-scope-eyebrow {
    color: rgb(100, 116, 139);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 4px;
  }
  .proposal-scope-title { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.25; }
  .proposal-scope-label-detail { margin-left: 4px; font-weight: 400; color: rgb(113, 113, 122); font-size: 16px; }
  :is(.dark) .proposal-scope-label-detail { color: rgb(161, 161, 170); }
  .proposal-scope-summary { margin: 4px 0 0; font-size: 13px; color: rgb(100, 116, 139); }
  :is(.dark) .proposal-scope-summary { color: rgb(161, 161, 170); }
  .proposal-scope-lineage { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 12px; color: rgb(113, 113, 122); }
  .proposal-scope-lineage-item:not(:last-child)::after { content: " ›"; margin-left: 8px; color: rgb(161, 161, 170); }

  .proposal-doc { padding: 16px 0 4px; border-top: 1px solid rgba(16, 24, 40, 0.05); }
  .proposal-doc:first-child { border-top: 0; padding-top: 0; }
  :is(.dark) .proposal-doc { border-top-color: rgba(255, 255, 255, 0.05); }
  .proposal-doc.compact { padding: 6px 0 0; }

  .proposal-doc-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .proposal-doc-id {
    color: rgb(113, 113, 122);
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  }
  .proposal-doc-title { margin: 0; font-size: 15px; font-weight: 600; }
  .proposal-doc.compact .proposal-doc-title { font-weight: 500; color: rgb(82, 82, 91); }
  :is(.dark) .proposal-doc.compact .proposal-doc-title { color: rgb(161, 161, 170); }

  .proposal-doc-badge {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .proposal-doc-badge.status-edited {
    color: rgb(180, 83, 9);
    background: rgba(245, 158, 11, 0.12);
  }
  .proposal-doc-badge.status-inserted {
    color: rgb(21, 128, 61);
    background: rgba(34, 197, 94, 0.12);
  }
  .proposal-doc-badge.status-deleted {
    color: rgb(159, 18, 57);
    background: rgba(239, 68, 68, 0.12);
  }
  :is(.dark) .proposal-doc-badge.status-edited { color: rgb(252, 211, 77); }
  :is(.dark) .proposal-doc-badge.status-inserted { color: rgb(134, 239, 172); }
  :is(.dark) .proposal-doc-badge.status-deleted { color: rgb(252, 165, 165); }

  .proposal-doc-body { margin-top: 8px; max-width: 920px; }
  .proposal-doc-body p { margin: 0 0 10px; }
  .proposal-doc-body p:last-child { margin-bottom: 0; }
  .proposal-doc-body ul { margin: 0 0 10px; padding-left: 20px; list-style: disc; }
  .proposal-doc-body li { margin: 0 0 4px; }
  .proposal-doc-body code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 0.9em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(16, 24, 40, 0.06);
  }
  :is(.dark) .proposal-doc-body code { background: rgba(255, 255, 255, 0.08); }
  .proposal-doc-body a { color: rgb(37, 99, 235); text-decoration: underline; }
  :is(.dark) .proposal-doc-body a { color: rgb(96, 165, 250); }

  /* The Python renderer's diff highlight classes. */
  .proposal-diff .diff-add {
    color: rgb(6, 95, 70);
    background-color: rgba(34, 197, 94, 0.18);
    border-radius: 3px;
    padding: 0 2px;
  }
  .proposal-diff .diff-del {
    color: rgb(127, 29, 29);
    background-color: rgba(239, 68, 68, 0.18);
    border-radius: 3px;
    padding: 0 2px;
    text-decoration: line-through;
  }
  /* word_diff (titleDiff) emits added / removed classes. Keep parity. */
  .proposal-diff .added {
    color: rgb(6, 95, 70);
    background-color: rgba(34, 197, 94, 0.18);
    border-radius: 3px;
    padding: 0 2px;
  }
  .proposal-diff .removed {
    color: rgb(127, 29, 29);
    background-color: rgba(239, 68, 68, 0.18);
    border-radius: 3px;
    padding: 0 2px;
    text-decoration: line-through;
  }
  :is(.dark) .proposal-diff .diff-add, :is(.dark) .proposal-diff .added { color: rgb(187, 247, 208); }
  :is(.dark) .proposal-diff .diff-del, :is(.dark) .proposal-diff .removed { color: rgb(254, 202, 202); }
`;
