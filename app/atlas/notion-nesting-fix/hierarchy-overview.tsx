import { Card, CardBody, CardHeader } from '@heroui/react';
import { ArrowRight, FileText } from 'lucide-react';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { NotionNestingBugMapping } from '@/app/server/services/supabase/notion-nesting-bug-mappings';

/**
 * Hierarchy Overview Component
 *
 * Displays a visual summary of saved parent-child relationships grouped by database.
 * Shows the hierarchy using indentation and arrows. Only displays saved mappings.
 */

interface HierarchyOverviewProps {
  mappings: NotionNestingBugMapping[];
}

const DATABASES_WITH_NESTING: AtlasDatabaseName[] = ['Sections & Primary Docs', 'Agent Scope Database'];

export function HierarchyOverview({ mappings }: HierarchyOverviewProps) {
  const getMappingsForDatabase = (database: AtlasDatabaseName): NotionNestingBugMapping[] => {
    return mappings.filter((m) => m.atlas_database_name === database);
  };

  // Don't show the overview if there are no saved mappings
  if (mappings.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 border border-slate-200" shadow="none">
      <CardHeader className="border-b border-slate-200 pb-3">
        <h2 className="text-lg font-semibold text-slate-800">Hierarchy Overview</h2>
      </CardHeader>
      <CardBody className="gap-6 py-4">
        {DATABASES_WITH_NESTING.map((database) => {
          const databaseMappings = getMappingsForDatabase(database);

          // Skip database if no mappings
          if (databaseMappings.length === 0) {
            return null;
          }

          return (
            <div key={database} className="space-y-3">
              <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-700">{database}</h3>
              <div className="space-y-4">
                {databaseMappings.map((mapping, index) => (
                  <div key={`${mapping.child_notion_page_id}-${mapping.parent_notion_page_id}`} className="space-y-1">
                    {/* Parent */}
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileText size={16} className="flex-shrink-0 text-slate-500" />
                      <span className="text-sm font-medium">
                        {mapping.parent_label || <span className="text-slate-400 italic">Unlabeled</span>}
                      </span>
                    </div>
                    {/* Child - indented with arrow */}
                    <div className="flex items-center gap-2 pl-8 text-slate-600">
                      <ArrowRight size={14} className="flex-shrink-0 text-slate-400" />
                      <span className="text-sm">
                        {mapping.child_label || <span className="text-slate-400 italic">Unlabeled</span>}
                      </span>
                    </div>
                    {/* Separator between mappings (except last one) */}
                    {index < databaseMappings.length - 1 && <div className="my-3 border-t border-slate-100" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
