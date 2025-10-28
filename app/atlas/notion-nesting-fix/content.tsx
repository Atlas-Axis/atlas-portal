'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { AtlasDatabaseName } from '@/app/server/atlas/constants';
import { NotionNestingBugMapping } from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { saveMappingsAction } from './_actions/nesting-fix-actions';

/**
 * Notion Nesting Bug Fix - UI Content
 *
 * Client component for managing parent-child relationship mappings. Grouped by database,
 * shows document names from lookup, validates UUIDs and circular dependencies.
 *
 * @see {@link file://../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */

interface ContentProps {
  initialMappings: NotionNestingBugMapping[];
  documentLookup: Record<string, string>;
}

interface MappingWithId extends NotionNestingBugMapping {
  id: string; // Temporary ID for React key
}

const DATABASES_WITH_NESTING: AtlasDatabaseName[] = ['Sections & Primary Docs', 'Agent Scope Database'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function Content({ initialMappings, documentLookup }: ContentProps) {
  const [mappings, setMappings] = useState<MappingWithId[]>(
    initialMappings.map((m, i) => ({ ...m, id: `${i}-${Date.now()}` })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getDocumentName = (uuid: string): string => {
    return documentLookup[uuid] || 'Unknown document';
  };

  const isValidUUID = (uuid: string): boolean => {
    return UUID_REGEX.test(uuid);
  };

  const hasCircularDependency = (childId: string, parentId: string): boolean => {
    // Check if parentId would create a cycle by being a descendant of childId
    const visited = new Set<string>();
    let currentId: string | undefined = parentId;

    while (currentId && !visited.has(currentId)) {
      if (currentId === childId) {
        return true; // Found cycle
      }
      visited.add(currentId);
      // Find next parent in chain
      const nextMapping = mappings.find((m) => m.child_notion_page_id === currentId);
      currentId = nextMapping?.parent_notion_page_id;
    }

    return false;
  };

  const getMappingsByDatabase = (database: AtlasDatabaseName): MappingWithId[] => {
    return mappings.filter((m) => m.atlas_database_name === database);
  };

  const addMapping = (database: AtlasDatabaseName) => {
    const newMapping: MappingWithId = {
      id: `new-${Date.now()}-${Math.random()}`,
      child_notion_page_id: '',
      parent_notion_page_id: '',
      atlas_database_name: database,
    };
    setMappings([...mappings, newMapping]);
  };

  const updateMapping = (id: string, field: 'child_notion_page_id' | 'parent_notion_page_id', value: string) => {
    setMappings(mappings.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const deleteMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id));
  };

  const validateMappings = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    for (const mapping of mappings) {
      const { child_notion_page_id, parent_notion_page_id, atlas_database_name } = mapping;

      // Check if fields are filled
      if (!child_notion_page_id || !parent_notion_page_id) {
        errors.push(`Mapping in "${atlas_database_name}" has empty fields`);
        continue;
      }

      // Validate UUID format
      if (!isValidUUID(child_notion_page_id)) {
        errors.push(`Invalid child UUID format in "${atlas_database_name}": ${child_notion_page_id}`);
      }
      if (!isValidUUID(parent_notion_page_id)) {
        errors.push(`Invalid parent UUID format in "${atlas_database_name}": ${parent_notion_page_id}`);
      }

      // Check for circular dependencies
      if (hasCircularDependency(child_notion_page_id, parent_notion_page_id)) {
        errors.push(
          `Circular dependency detected in "${atlas_database_name}": ${child_notion_page_id} → ${parent_notion_page_id}`,
        );
      }

      // Check for same child and parent
      if (child_notion_page_id === parent_notion_page_id) {
        errors.push(`Child and parent cannot be the same in "${atlas_database_name}"`);
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const handleSave = async () => {
    setSaveMessage(null);

    // Validate
    const { valid, errors } = validateMappings();
    if (!valid) {
      setSaveMessage({ type: 'error', text: `Validation errors:\n${errors.join('\n')}` });
      return;
    }

    setIsSaving(true);

    try {
      // Remove temporary IDs before saving
      const mappingsToSave = mappings.map(({ id, ...rest }) => rest);
      const result = await saveMappingsAction(mappingsToSave);

      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Mappings saved successfully!' });
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${result.error}` });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mx-auto max-w-7xl p-6">
      <CardHeader className="mb-4 flex-col items-start gap-2 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Notion Nesting Fix</h1>
        <p className="text-sm text-slate-600">
          Fix nesting issues in Notion Atlas documents by manually defining parent-child relationships. This tool
          overrides incorrect relationships during Notion imports.
        </p>
      </CardHeader>
      <CardBody className="gap-8 py-6">
        {DATABASES_WITH_NESTING.map((database) => {
          const databaseMappings = getMappingsByDatabase(database);

          return (
            <div key={database} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">{database}</h2>
                <Button
                  size="sm"
                  color="primary"
                  startContent={<Plus size={16} />}
                  onPress={() => addMapping(database)}
                >
                  Add Mapping
                </Button>
              </div>

              {databaseMappings.length === 0 ? (
                <p className="text-sm text-slate-500">No mappings defined for this database</p>
              ) : (
                <div className="space-y-4">
                  {databaseMappings.map((mapping) => (
                    <Card key={mapping.id} className="border border-slate-200 shadow-sm">
                      <CardBody className="gap-4 p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Child Document</label>
                            <p className="mb-2 text-sm font-medium text-slate-800">
                              {mapping.child_notion_page_id
                                ? getDocumentName(mapping.child_notion_page_id)
                                : 'Enter child UUID'}
                            </p>
                            <Input
                              size="sm"
                              placeholder="Child UUID"
                              value={mapping.child_notion_page_id}
                              onChange={(e) => updateMapping(mapping.id, 'child_notion_page_id', e.target.value)}
                              classNames={{
                                input: 'font-mono text-xs',
                              }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Parent Document</label>
                            <p className="mb-2 text-sm font-medium text-slate-800">
                              {mapping.parent_notion_page_id
                                ? getDocumentName(mapping.parent_notion_page_id)
                                : 'Enter parent UUID'}
                            </p>
                            <Input
                              size="sm"
                              placeholder="Parent UUID"
                              value={mapping.parent_notion_page_id}
                              onChange={(e) => updateMapping(mapping.id, 'parent_notion_page_id', e.target.value)}
                              classNames={{
                                input: 'font-mono text-xs',
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            startContent={<Trash2 size={14} />}
                            onPress={() => deleteMapping(mapping.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {saveMessage && (
          <div
            className={`rounded-lg p-4 ${
              saveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <pre className="text-sm whitespace-pre-wrap">{saveMessage.text}</pre>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button size="lg" color="primary" startContent={<Save size={18} />} onPress={handleSave} isLoading={isSaving}>
            Save All Mappings
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
