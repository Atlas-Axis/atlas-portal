import type { Metadata } from 'next';
import { loadAtlasPortalData } from '@/app/server/atlas/load-atlas-portal-data';
import AtlasPagePrerendered from './atlas-page-prerendered';

// Revalidate every hour — ISR serves cached page instantly,
// rebuilds in background when stale. No manual deploy needed.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sky Atlas',
  description: '',
};

export default async function Page() {
  const { exportScopeTrees, uuidMappings } = await loadAtlasPortalData();

  return <AtlasPagePrerendered exportScopeTreesWithoutAgents={exportScopeTrees} uuidMappings={uuidMappings} />;
}
