import type { Metadata } from 'next';
import { findCurrentProposal } from '@/app/server/proposal/find-current-proposal';
import { loadProposalData } from '@/app/server/proposal/load-proposal-data';
import ProposalPagePrerendered from './proposal-page-prerendered';

// Build-time static. Mirrors the `/atlas` pattern: proposal data is fetched,
// parsed, and diffed once at `next build`; runtime requests are pure CDN serves.
export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Atlas Edit Proposal',
  description: 'Community view of the current Atlas Edit Proposal — summary and diff.',
};

export default async function Page() {
  const proposal = await findCurrentProposal();
  if (!proposal) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-zinc-700 dark:text-zinc-200">
        <h1 className="mb-4 text-2xl font-semibold">Atlas Edit Proposal</h1>
        <p>No current proposal found. Check back when the next Atlas Edit Cycle opens.</p>
      </div>
    );
  }
  const data = await loadProposalData(proposal);
  return <ProposalPagePrerendered data={data} />;
}
