import type { Metadata } from 'next';
import { loadAtlasPortalData } from '@/app/server/atlas/load-atlas-portal-data';
import AtlasPagePrerendered from './atlas-page-prerendered';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Sky Atlas',
  description: '',
};

console.log('/atlas is being prerendered');

export default async function Page() {
  const { exportScopeTrees, uuidMappings } = await loadAtlasPortalData();

  return <AtlasPagePrerendered exportScopeTreesWithoutAgents={exportScopeTrees} uuidMappings={uuidMappings} />;
}
