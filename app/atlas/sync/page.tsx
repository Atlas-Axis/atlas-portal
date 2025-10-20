import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { Content } from './content';

export default async function AtlasSyncPage() {
  const result = await diffAtlasScopeTreeLists();

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6">
      <Content result={result} />
    </div>
  );
}
