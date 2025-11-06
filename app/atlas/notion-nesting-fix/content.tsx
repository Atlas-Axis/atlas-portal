'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { NotionNestingBugMapping } from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { isValidUUID, normalizeUUID } from '@/app/shared/utils/utils';
import { saveMappingsAction } from './_actions/nesting-fix-actions';
import { UuidVerificationResult, verifyUuidAction } from './_actions/verify-uuid-action';
import { HierarchyOverview } from './hierarchy-overview';

/**
 * Notion Nesting Bug Fix - UI Content
 *
 * Client component for managing parent-child relationship mappings. Grouped by database,
 * allows users to add custom labels for documents, validates UUIDs and circular dependencies.
 *
 * @see {@link file://../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */

interface ContentProps {
  initialMappings: NotionNestingBugMapping[];
}

interface MappingWithId extends NotionNestingBugMapping {
  id: string; // Temporary ID for React key
}

interface VerificationState {
  child?: UuidVerificationResult;
  parent?: UuidVerificationResult;
  sibling?: UuidVerificationResult;
  siblingIsValidChild?: boolean; // true if sibling is in parent's child array
}

const DATABASES_WITH_NESTING: AtlasDatabaseName[] = ['Sections & Primary Docs', 'Agent Scope Database'];

export function Content({ initialMappings }: ContentProps) {
  const [mappings, setMappings] = useState<MappingWithId[]>(
    initialMappings.map((m, i) => ({ ...m, id: `${i}-${Date.now()}` })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [verifications, setVerifications] = useState<Record<string, VerificationState>>({}); // By UUID

  // Validate all UUIDs on initial load
  useEffect(() => {
    const validateInitialMappings = async () => {
      for (const mapping of mappings) {
        // Verify child UUID
        if (mapping.child_notion_page_id && isValidUUID(mapping.child_notion_page_id)) {
          verifyUuid(mapping.id, 'child', mapping.child_notion_page_id);
        }

        // Verify parent UUID
        if (mapping.parent_notion_page_id && isValidUUID(mapping.parent_notion_page_id)) {
          verifyUuid(mapping.id, 'parent', mapping.parent_notion_page_id);
        }

        // Verify sibling UUID if present
        if (mapping.place_after_sibling_notion_page_id && isValidUUID(mapping.place_after_sibling_notion_page_id)) {
          verifyUuid(mapping.id, 'sibling', mapping.place_after_sibling_notion_page_id);
        }
      }
    };

    validateInitialMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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
      child_label: undefined,
      parent_label: undefined,
      place_after_sibling_notion_page_id: undefined,
      place_after_sibling_label: undefined,
    };
    setMappings([...mappings, newMapping]);
  };

  const updateMapping = (
    id: string,
    field:
      | 'child_notion_page_id'
      | 'parent_notion_page_id'
      | 'child_label'
      | 'parent_label'
      | 'place_after_sibling_notion_page_id'
      | 'place_after_sibling_label',
    value: string,
  ) => {
    setMappings(mappings.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

    // Clear verification for this field when value changes
    if (['child_notion_page_id', 'parent_notion_page_id', 'place_after_sibling_notion_page_id'].includes(field)) {
      const verificationField =
        field === 'child_notion_page_id' ? 'child' : field === 'parent_notion_page_id' ? 'parent' : 'sibling';

      setVerifications((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [verificationField]: undefined,
          ...(verificationField === 'parent' || verificationField === 'sibling'
            ? { siblingIsValidChild: undefined }
            : {}),
        },
      }));
    }
  };

  const handleUuidBlur = (
    id: string,
    field: 'child_notion_page_id' | 'parent_notion_page_id' | 'place_after_sibling_notion_page_id',
    value: string,
  ) => {
    // Skip empty values
    if (!value.trim()) return;

    try {
      // Normalize the UUID to hyphenated format
      const normalized = normalizeUUID(value.trim());
      // Update the mapping with normalized value
      updateMapping(id, field, normalized);
    } catch (error) {
      // If normalization fails, leave the value as-is for validation to catch
      console.warn(`Failed to normalize UUID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id));
  };

  const verifyUuid = async (mappingId: string, field: 'child' | 'parent' | 'sibling', uuid: string) => {
    if (!uuid || !isValidUUID(uuid)) return;

    const result = await verifyUuidAction(uuid);

    // Update verification and check sibling-parent relationship in a single state update
    setVerifications((prev) => {
      const updatedVerification = {
        ...prev[mappingId],
        [field]: result,
      };

      // If verifying parent or sibling, check sibling-parent relationship
      if (field === 'parent' || field === 'sibling') {
        const mapping = mappings.find((m) => m.id === mappingId);

        if (updatedVerification.parent && updatedVerification.sibling && mapping) {
          const childArrayField =
            mapping.atlas_database_name === 'Sections & Primary Docs'
              ? 'child_section_and_primary_doc_ids'
              : 'child_agent_scope_ids';

          const siblingId = mapping.place_after_sibling_notion_page_id;
          if (siblingId) {
            const siblingIsValid = updatedVerification.parent[childArrayField]?.includes(siblingId) ?? false;
            updatedVerification.siblingIsValidChild = siblingIsValid;
          }
        }
      }

      return {
        ...prev,
        [mappingId]: updatedVerification,
      };
    });
  };

  const getVerificationIndicator = (mappingId: string, field: 'child' | 'parent' | 'sibling'): string => {
    const verification = verifications[mappingId]?.[field];

    if (!verification) return '';

    if (!verification.exists) return ' ✗';

    // For sibling field, also check if it's a valid child of parent
    if (field === 'sibling') {
      const siblingIsValid = verifications[mappingId]?.siblingIsValidChild;
      if (siblingIsValid === false) return ' ✗ (not a child of parent)';
      if (siblingIsValid === true) return ' ✓';
      return ' ✓'; // exists but relationship not checked yet
    }

    return ' ✓';
  };

  const hasVerificationFailed = (mappingId: string, field: 'child' | 'parent' | 'sibling'): boolean => {
    const verification = verifications[mappingId]?.[field];

    if (!verification) return false;

    if (!verification.exists) return true;

    // For sibling field, also check if relationship validation failed
    if (field === 'sibling') {
      const siblingIsValid = verifications[mappingId]?.siblingIsValidChild;
      if (siblingIsValid === false) return true;
    }

    return false;
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

      // Validate sibling UUID format if provided (optional field)
      if (mapping.place_after_sibling_notion_page_id && !isValidUUID(mapping.place_after_sibling_notion_page_id)) {
        errors.push(
          `Invalid sibling UUID format in "${atlas_database_name}": ${mapping.place_after_sibling_notion_page_id}`,
        );
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
      // Remove temporary IDs and clean up empty optional fields before saving
      const mappingsToSave = mappings.map(({ id, ...rest }) => {
        const cleaned: NotionNestingBugMapping = {
          child_notion_page_id: rest.child_notion_page_id,
          parent_notion_page_id: rest.parent_notion_page_id,
          atlas_database_name: rest.atlas_database_name,
        };

        // Only include optional fields if they have non-empty values
        if (rest.child_label?.trim()) {
          cleaned.child_label = rest.child_label.trim();
        }
        if (rest.parent_label?.trim()) {
          cleaned.parent_label = rest.parent_label.trim();
        }
        if (rest.place_after_sibling_notion_page_id?.trim()) {
          cleaned.place_after_sibling_notion_page_id = rest.place_after_sibling_notion_page_id.trim();
        }
        if (rest.place_after_sibling_label?.trim()) {
          cleaned.place_after_sibling_label = rest.place_after_sibling_label.trim();
        }

        return cleaned;
      });
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
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600">Child Document</label>
                              {mapping.child_notion_page_id && isValidUUID(mapping.child_notion_page_id) && (
                                <a
                                  href={`https://www.notion.so/${mapping.child_notion_page_id.replace(/-/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 transition-colors hover:text-blue-800"
                                  title="Open in Notion"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                            <Input
                              size="sm"
                              label="Label"
                              value={mapping.child_label || ''}
                              onChange={(e) => updateMapping(mapping.id, 'child_label', e.target.value)}
                              classNames={{
                                input: 'text-sm font-medium',
                              }}
                              className="mb-2"
                            />
                            <Input
                              size="sm"
                              label={`Notion page ID${getVerificationIndicator(mapping.id, 'child')}`}
                              placeholder="Child UUID"
                              value={mapping.child_notion_page_id}
                              onChange={(e) => updateMapping(mapping.id, 'child_notion_page_id', e.target.value)}
                              onBlur={(e) => {
                                handleUuidBlur(mapping.id, 'child_notion_page_id', e.target.value);
                                verifyUuid(mapping.id, 'child', e.target.value);
                              }}
                              isInvalid={hasVerificationFailed(mapping.id, 'child')}
                              errorMessage={
                                hasVerificationFailed(mapping.id, 'child') ? 'UUID not found in database' : ''
                              }
                              classNames={{
                                input: 'font-mono text-xs',
                              }}
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600">Parent Document</label>
                              {mapping.parent_notion_page_id && isValidUUID(mapping.parent_notion_page_id) && (
                                <a
                                  href={`https://www.notion.so/${mapping.parent_notion_page_id.replace(/-/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 transition-colors hover:text-blue-800"
                                  title="Open in Notion"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                            <Input
                              size="sm"
                              label="Label"
                              value={mapping.parent_label || ''}
                              onChange={(e) => updateMapping(mapping.id, 'parent_label', e.target.value)}
                              classNames={{
                                input: 'text-sm font-medium',
                              }}
                              className="mb-2"
                            />
                            <Input
                              size="sm"
                              label={`Notion page ID${getVerificationIndicator(mapping.id, 'parent')}`}
                              placeholder="Parent UUID"
                              value={mapping.parent_notion_page_id}
                              onChange={(e) => updateMapping(mapping.id, 'parent_notion_page_id', e.target.value)}
                              onBlur={(e) => {
                                handleUuidBlur(mapping.id, 'parent_notion_page_id', e.target.value);
                                verifyUuid(mapping.id, 'parent', e.target.value);
                              }}
                              isInvalid={hasVerificationFailed(mapping.id, 'parent')}
                              errorMessage={
                                hasVerificationFailed(mapping.id, 'parent') ? 'UUID not found in database' : ''
                              }
                              classNames={{
                                input: 'font-mono text-xs',
                              }}
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <label className="text-xs font-medium text-slate-600">
                                Place After Sibling <span className="text-slate-400">(optional)</span>
                              </label>
                              {mapping.place_after_sibling_notion_page_id &&
                                isValidUUID(mapping.place_after_sibling_notion_page_id) && (
                                  <a
                                    href={`https://www.notion.so/${mapping.place_after_sibling_notion_page_id.replace(/-/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 transition-colors hover:text-blue-800"
                                    title="Open in Notion"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                            </div>
                            <Input
                              size="sm"
                              label="Label"
                              value={mapping.place_after_sibling_label || ''}
                              onChange={(e) => updateMapping(mapping.id, 'place_after_sibling_label', e.target.value)}
                              classNames={{
                                input: 'text-sm font-medium',
                              }}
                              className="mb-2"
                            />
                            <Input
                              size="sm"
                              label={`Notion page ID${getVerificationIndicator(mapping.id, 'sibling')}`}
                              placeholder="Sibling UUID (optional)"
                              value={mapping.place_after_sibling_notion_page_id || ''}
                              onChange={(e) =>
                                updateMapping(mapping.id, 'place_after_sibling_notion_page_id', e.target.value)
                              }
                              onBlur={(e) => {
                                handleUuidBlur(mapping.id, 'place_after_sibling_notion_page_id', e.target.value);
                                verifyUuid(mapping.id, 'sibling', e.target.value);
                              }}
                              isInvalid={hasVerificationFailed(mapping.id, 'sibling')}
                              errorMessage={
                                hasVerificationFailed(mapping.id, 'sibling')
                                  ? verifications[mapping.id]?.siblingIsValidChild === false
                                    ? 'Sibling is not a child of the parent document'
                                    : 'UUID not found in database'
                                  : ''
                              }
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

        <HierarchyOverview mappings={initialMappings} />
      </CardBody>
    </Card>
  );
}
