import type { Metadata } from 'next';
import { loadAtlasPortalData } from '@/app/server/atlas/load-atlas-portal-data';
import AtlasPagePrerendered from './atlas-page-prerendered';

// Build-time static generation. The Atlas content is fetched, composed,
// parsed, and validated once at `next build`; runtime requests are pure
// CDN serves with no GitHub round-trips, no tarball extract, and no parse
// work on the hot path. Atlas updates ship via a Vercel Deploy Hook fired
// by a webhook on the upstream content repo's main branch — see README.
export const dynamic = 'force-static';
// `revalidate = false` makes this fully static; only a fresh deploy can
// update the page. The deploy-hook webhook handles invalidation.
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Sky Atlas',
  description: '',
};

export default async function Page() {
  const { exportScopeTrees, uuidMappings } = await loadAtlasPortalData();

  return <AtlasPagePrerendered exportScopeTreesWithoutAgents={exportScopeTrees} uuidMappings={uuidMappings} />;
}
