'use client';

import { useEffect } from 'react';

/**
 * Upgrades in-proposal cross-references to in-page scroll-and-highlight links.
 *
 * The server renders every UUID cross-reference as
 *
 *   <a href="https://sky-atlas.io/#<uuid>" target="_blank" rel="noopener"
 *      data-xref-uuid="<uuid>">Doc Name</a>
 *
 * That is the right behavior for cross-references whose target document is
 * NOT in the current proposal — clicking opens the Atlas viewer in a new
 * tab so the reader sees the canonical version.
 *
 * For cross-references whose target IS rendered on this page, opening the
 * Atlas viewer would show the pre-proposal version. This component upgrades
 * those links to in-page scroll + brief highlight after React hydration
 * completes (an earlier inline-script implementation was clobbered by the
 * hydration pass, leaving every link in its server-default state).
 *
 * Mirrors atlas-review's `transformCrossRefs` behavior.
 */
export default function CrossRefUpgrader() {
  useEffect(() => {
    const docNodes = document.querySelectorAll('[data-doc-uuid]');
    if (!docNodes.length) return;

    const inProposal = new Set<string>();
    docNodes.forEach((node) => {
      const uuid = node.getAttribute('data-doc-uuid');
      if (uuid) inProposal.add(uuid);
    });

    const links = document.querySelectorAll<HTMLAnchorElement>('.proposal-doc-body a[data-xref-uuid]');
    links.forEach((link) => {
      const uuid = link.getAttribute('data-xref-uuid');
      if (!uuid || !inProposal.has(uuid)) return;

      link.setAttribute('href', `#${uuid}`);
      link.removeAttribute('target');
      link.removeAttribute('rel');
      link.style.cursor = 'pointer';

      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.querySelector(`[data-doc-uuid="${CSS.escape(uuid)}"]`);
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Brief box-shadow flash so the reader's eye lands on the right doc.
        const element = target as HTMLElement;
        const prevShadow = element.style.boxShadow;
        const prevTransition = element.style.transition;
        element.style.transition = 'box-shadow 0.3s';
        element.style.boxShadow = '0 0 0 2px rgb(245 158 11 / 0.7)';
        setTimeout(() => {
          element.style.boxShadow = prevShadow;
          setTimeout(() => {
            element.style.transition = prevTransition;
          }, 400);
        }, 1200);
      });
    });
  }, []);

  return null;
}
