'use client';

import { useMemo, useRef, useState } from 'react';
import { Alert } from '@heroui/alert';
import { Checkbox } from '@heroui/checkbox';
import { Divider } from '@heroui/divider';
import { Button, Card, CardBody, CardHeader, Chip, Progress } from '@heroui/react';
import TypeChip from '@/app/atlas/type-chip';
import { CustomHTML } from '@/app/components/custom-html';
import { InlineTextDiff } from '@/app/components/inline-text-diff';
import type { AtlasChangeType, AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { type SerializedUuidMappings, deserializeUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import { cn } from '@/app/shared/utils/utils';
import { SyncLogEntry, SyncPhase, syncChangesToNotion } from './_lib/sync-orchestrator';

const colors: {
  [K in AtlasChangeType]: { background: string; border: string; text: string; sectionBackground: string };
} = {
  added: {
    background: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-800',
    sectionBackground: 'bg-green-600',
  },
  changed: {
    background: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-800',
    sectionBackground: 'bg-blue-600',
  },
  sibling_order_changed: {
    background: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-800',
    sectionBackground: 'bg-yellow-600',
  },
  parent_changed: {
    background: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-800',
    sectionBackground: 'bg-orange-600',
  },
  deleted: {
    background: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-800',
    sectionBackground: 'bg-red-600',
  },
};

interface SyncState {
  isRunning: boolean;
  stopRequested: boolean;
  currentPhase: SyncPhase;
  progress: { total: number; completed: number };
  currentDocument: string | null;
  logs: SyncLogEntry[];
  completed: boolean;
}

/**
 * Note: Structural changes (parent_changed, sibling_order_changed) are not shown yet - will be enabled later!
 */
export function Content({
  result,
  serializedMappings,
}: {
  result: AtlasDiffResult;
  serializedMappings: SerializedUuidMappings;
}) {
  const { changes, originalIdsToDocuments, newIdsToDocuments } = result;
  const hasChanges =
    changes.added.length > 0 ||
    changes.changed.length > 0 ||
    changes.sibling_order_changed.length > 0 ||
    changes.parent_changed.length > 0 ||
    changes.deleted.length > 0;

  // Deserialize UUID mappings once (passed from server component)
  const uuidMappings = useMemo(() => deserializeUuidMappings(serializedMappings), [serializedMappings]);

  // Create UUID to document number map for markdown link conversion
  // Prefer new documents (for added/changed), fallback to original (for deleted)
  const uuidToDocNoMap = useMemo(() => {
    const map = new Map<string, string>();
    // Add original documents first
    originalIdsToDocuments.forEach((doc, uuid) => {
      map.set(uuid, doc.doc_no);
    });
    // Override with new documents (so we use latest doc numbers)
    newIdsToDocuments.forEach((doc, uuid) => {
      map.set(uuid, doc.doc_no);
    });
    return map;
  }, [originalIdsToDocuments, newIdsToDocuments]);

  const [syncState, setSyncState] = useState<SyncState>({
    isRunning: false,
    stopRequested: false,
    currentPhase: 'idle',
    progress: { total: 0, completed: 0 },
    currentDocument: null,
    logs: [],
    completed: false,
  });

  // Use ref for stop flag so it can be read by sync function without re-rendering
  const syncOptionsRef = useRef({ stopRequested: false });

  const handleSyncClick = async () => {
    setSyncState({
      isRunning: true,
      stopRequested: false,
      currentPhase: 'content',
      progress: {
        total:
          changes.changed.length +
          changes.added.length +
          changes.deleted.length +
          changes.sibling_order_changed.length +
          changes.parent_changed.length,
        completed: 0,
      },
      currentDocument: null,
      logs: [],
      completed: false,
    });

    syncOptionsRef.current.stopRequested = false;

    try {
      const syncResult = await syncChangesToNotion(result, syncOptionsRef.current, uuidMappings, (progress) => {
        setSyncState((prev) => ({
          ...prev,
          currentPhase: progress.phase,
          progress: { total: progress.totalCount, completed: progress.completedCount },
          currentDocument: progress.currentDocumentLabel,
        }));
      });

      setSyncState((prev) => ({
        ...prev,
        isRunning: false,
        currentPhase: 'idle',
        logs: syncResult.logs,
        completed: true,
      }));
    } catch (error) {
      const err = error as Error;
      setSyncState((prev) => ({
        ...prev,
        isRunning: false,
        currentPhase: 'idle',
        logs: [
          ...prev.logs,
          {
            timestamp: new Date(),
            message: `Sync failed: ${err.message}`,
            type: 'error',
          },
        ],
        completed: true,
      }));
    }
  };

  const handleStopClick = () => {
    syncOptionsRef.current.stopRequested = true;
    setSyncState((prev) => ({
      ...prev,
      stopRequested: true,
    }));
  };

  return (
    <Card className="container mx-auto max-w-7xl p-6">
      <CardHeader>
        <h1 className="text-3xl font-bold">Atlas Sync - Markdown to Notion</h1>
      </CardHeader>

      <Divider className="my-4" />

      {!hasChanges && (
        <Alert variant="faded" color="success" className="mb-6 max-w-lg">
          There are no changes
        </Alert>
      )}

      <CardBody>
        {/* Added Documents */}
        <ChangeSection
          title="Added"
          changes={changes.added}
          changeType="added"
          emptyMessage="No documents added"
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
        />

        {/* Changed Documents */}
        <ChangeSection
          title="Changed"
          changes={changes.changed}
          changeType="changed"
          emptyMessage="No document content changes"
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
        />

        {/* Sibling Order Changed */}
        <ChangeSection
          title="Order / Document No Changed"
          changes={changes.sibling_order_changed}
          changeType="sibling_order_changed"
          emptyMessage="No sibling order changes"
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
        />

        {/* Parent Changed */}
        <ChangeSection
          title="Parent Changed"
          changes={changes.parent_changed}
          changeType="parent_changed"
          emptyMessage="No parent changes"
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
        />

        {/* Deleted Documents */}
        <ChangeSection
          title="Deleted"
          changes={changes.deleted}
          changeType="deleted"
          emptyMessage="No documents deleted"
          uuidToDocMap={originalIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
        />

        <p className="my-3 text-xs text-slate-300">Limitations: Moved documents are not shown yet.</p>

        {/* Sync Controls and Progress */}
        <div className="my-6">
          {/* Sync Button */}
          <div className="flex justify-center gap-3">
            <Button
              size="lg"
              onPress={handleSyncClick}
              variant="solid"
              color="primary"
              isLoading={syncState.isRunning}
              isDisabled={syncState.isRunning || !hasChanges}
            >
              Sync Changes to Notion
            </Button>
            {syncState.isRunning && !syncState.stopRequested && (
              <Button size="lg" onPress={handleStopClick} variant="bordered" color="warning">
                Stop
              </Button>
            )}
          </div>

          {/* Progress Display */}
          {(syncState.isRunning || syncState.completed) && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
              {/* Phase and Progress */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Sync Progress:</span>
                    <PhaseChip phase={syncState.currentPhase} />
                    {syncState.stopRequested && (
                      <Chip color="warning" size="sm">
                        Stopping...
                      </Chip>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    {syncState.progress.completed} / {syncState.progress.total}
                  </span>
                </div>
                <Progress
                  value={
                    syncState.progress.total > 0 ? (syncState.progress.completed / syncState.progress.total) * 100 : 0
                  }
                  color={syncState.completed ? 'success' : 'primary'}
                  className="max-w-full"
                />
              </div>

              {/* Current Document */}
              {syncState.currentDocument && (
                <div className="mb-4 text-sm text-gray-700">
                  <span className="font-medium">Processing:</span> {syncState.currentDocument}
                </div>
              )}

              {/* Logs */}
              {syncState.logs.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 font-semibold">Log:</div>
                  <div className="max-h-96 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3">
                    {syncState.logs.map((log, idx) => (
                      <div key={idx} className={cn('mb-1 font-mono text-xs', getLogColorClass(log.type))}>
                        <span className="text-gray-500">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function PhaseChip({ phase }: { phase: SyncPhase }) {
  const phaseLabels: Record<SyncPhase, string> = {
    content: 'Content Changes',
    additions: 'Additions',
    deletions: 'Deletions',
    idle: 'Idle',
  };

  const phaseColors: Record<SyncPhase, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
    content: 'primary',
    additions: 'success',
    deletions: 'danger',
    idle: 'default',
  };

  return (
    <Chip size="sm" color={phaseColors[phase]}>
      {phaseLabels[phase]}
    </Chip>
  );
}

function getLogColorClass(type: SyncLogEntry['type']): string {
  switch (type) {
    case 'success':
      return 'text-green-700';
    case 'error':
      return 'text-red-700';
    case 'warning':
      return 'text-yellow-700';
    case 'info':
    default:
      return 'text-gray-700';
  }
}

function ChangeSection({
  title,
  changes,
  changeType,
  emptyMessage,
  uuidToDocMap,
  uuidToDocNoMap,
}: {
  title: string;
  changes: AtlasDocumentChange[];
  changeType: AtlasChangeType;
  emptyMessage: string;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
  uuidToDocNoMap: Map<string, string>;
}) {
  const colorConfig = colors[changeType];

  // Track checkbox state for each change (default to checked for user convenience)
  // Sibling order changes are excluded as they're not synced yet
  const [checkboxStates, setCheckboxStates] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    changes.forEach((change, index) => {
      if (change.changeType !== 'sibling_order_changed') {
        initialState[`${change.uuid}-${index}`] = true; // Default to checked
      }
    });
    return initialState;
  });

  if (changes.length === 0) {
    return null;
    return (
      <div className="mb-3">
        <h2
          className={cn(`mb-4 text-2xl font-semibold ${colorConfig.text}`, {
            hidden: changes.length === 0,
          })}
        >
          {title}
        </h2>
        <p className="text-sm text-gray-300 italic">{emptyMessage}</p>
      </div>
    );
  }

  // Calculate if all checkboxes are checked (for indeterminate state)
  const checkableChanges = changes.filter((change) => change.changeType !== 'sibling_order_changed');
  const allChecked =
    checkableChanges.length > 0 && checkableChanges.every((change, index) => checkboxStates[`${change.uuid}-${index}`]);
  const someChecked = checkableChanges.some((change, index) => checkboxStates[`${change.uuid}-${index}`]);

  // Toggle all checkboxes
  const handleToggleAll = () => {
    const newState: Record<string, boolean> = {};
    const newValue = !allChecked;
    changes.forEach((change, index) => {
      if (change.changeType !== 'sibling_order_changed') {
        newState[`${change.uuid}-${index}`] = newValue;
      }
    });
    setCheckboxStates(newState);
  };

  // Toggle individual checkbox
  const handleToggleCheckbox = (key: string) => {
    setCheckboxStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="my-9">
      <div
        className={`-mx-3 my-3 mb-6 flex items-center gap-3 rounded-md ${colorConfig.sectionBackground} p-3 text-white`}
      >
        {checkableChanges.length > 0 && (
          <Checkbox
            size="md"
            isSelected={allChecked}
            isIndeterminate={someChecked && !allChecked}
            onValueChange={handleToggleAll}
          />
        )}
        <h2 className="text-2xl font-semibold">
          {title} ({changes.length})
        </h2>
      </div>
      <div>
        {changes.map((change, index) => (
          <ChangeCard
            key={`${change.uuid}-${index}`}
            change={change}
            uuidToDocMap={uuidToDocMap}
            uuidToDocNoMap={uuidToDocNoMap}
            isChecked={checkboxStates[`${change.uuid}-${index}`] ?? true}
            onToggleCheckbox={() => handleToggleCheckbox(`${change.uuid}-${index}`)}
          />
        ))}
      </div>
    </div>
  );
}

// Format UUID as document reference
function formatDocReference(
  uuid: string,
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>,
): string {
  const refDoc = uuidToDocMap.get(uuid);
  if (refDoc) {
    return `${refDoc.doc_no} - ${refDoc.name} [${refDoc.type}]`;
  }
  return uuid; // Fallback to UUID if not found
}

function ChangeCard({
  change,
  uuidToDocMap,
  uuidToDocNoMap,
  isChecked,
  onToggleCheckbox,
}: {
  change: AtlasDocumentChange;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
  uuidToDocNoMap: Map<string, string>;
  isChecked?: boolean;
  onToggleCheckbox?: () => void;
}) {
  const doc = change.newValues ?? change.oldValues;
  if (!doc) return null;

  return (
    <div className="flex items-center gap-3">
      {change.changeType !== 'sibling_order_changed' && (
        <Checkbox size="md" isSelected={isChecked} onValueChange={onToggleCheckbox} className="mt-1" />
      )}
      <Card className="flex-1" radius="none" shadow="none">
        <CardBody className="flex flex-col gap-0">
          {/* Document title in Atlas style */}
          <div className="flex items-center gap-2 text-base font-semibold">
            <span>
              {doc.doc_no} - {doc.name}
            </span>
            <TypeChip type={doc.type} />
          </div>

          {/* Show inline diff for content changes */}
          {change.changeType === 'changed' && change.oldValues && change.newValues && (
            <FieldChanges oldDoc={change.oldValues} newDoc={change.newValues} />
          )}

          {/* Show parent change details */}
          {change.changeType === 'parent_changed' && (
            <div className={`my-2 mt-2 rounded p-3 ${colors.parent_changed.background} `}>
              <div className="text-sm">
                <div className="mb-1 text-sm font-semibold">Parent Document</div>
                <span className="text-red-600">
                  {change.oldAncestry && change.oldAncestry.length > 0
                    ? formatDocReference(change.oldAncestry[change.oldAncestry.length - 1], uuidToDocMap)
                    : 'root'}
                </span>
                <span className="px-2"> → </span>
                <span className="text-green-600">
                  {change.newAncestry && change.newAncestry.length > 0
                    ? formatDocReference(change.newAncestry[change.newAncestry.length - 1], uuidToDocMap)
                    : 'root'}
                </span>
              </div>

              <div className="mt-2 text-sm">
                <div className="mb-1 text-sm font-semibold">Doc No</div>
                <span className="text-red-600">{change.oldValues?.doc_no}</span>
                <span className="px-2"> → </span>
                <span className="text-green-600">{change.newValues?.doc_no}</span>
              </div>
            </div>
          )}

          {/* Show sibling order change details */}
          {change.changeType === 'sibling_order_changed' && (
            <div className={`mt-2 rounded p-3 ${colors.sibling_order_changed.background} `}>
              <div className="text-sm">
                <span className="text-red-600">{change.oldValues?.doc_no}</span>
                <span className="px-2"> → </span>
                <span className="text-green-600">{change.newValues?.doc_no}</span>
              </div>
            </div>
          )}

          {/* Show content and extra fields for added documents */}
          {change.changeType === 'added' && change.newValues && (
            <div className="mt-2">
              <div className={`rounded p-3 ${colors.added.background} `}>
                <DocumentContent doc={change.newValues} uuidToDocNoMap={uuidToDocNoMap} />
              </div>
              <ParentDoc change={change} uuidToDocMap={uuidToDocMap} />
            </div>
          )}

          {/* Show content and extra fields for deleted documents */}
          {change.changeType === 'deleted' && change.oldValues && (
            <div className="mt-2">
              <div className={`mt-2 rounded p-3 ${colors.deleted.background} `}>
                <DocumentContent doc={change.oldValues} uuidToDocNoMap={uuidToDocNoMap} />
              </div>
              <ParentDoc change={change} uuidToDocMap={uuidToDocMap} />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ParentDoc({
  change,
  uuidToDocMap,
}: {
  change: AtlasDocumentChange;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
}) {
  const parentDocReferenceFormatted = (ancestry: string[] | undefined) => {
    if (ancestry && ancestry.length > 0) {
      const parentUuid = ancestry[ancestry.length - 1];
      return formatDocReference(parentUuid, uuidToDocMap);
    }
    return 'root';
  };

  return (
    <div className="mt-2 flex shrink-0 justify-end text-xs text-slate-400">
      {(change.changeType === 'added' || change.changeType === 'deleted') && (
        <div>
          <span className="font-medium">Parent: </span>{' '}
          {change.changeType === 'added'
            ? parentDocReferenceFormatted(change.newAncestry)
            : parentDocReferenceFormatted(change.oldAncestry)}
        </div>
      )}
    </div>
  );
}

function FieldChanges({
  oldDoc,
  newDoc,
}: {
  oldDoc: { type: string; name: string; content: string };
  newDoc: { type: string; name: string; content: string };
}) {
  const changes: Array<{ field: string; displayName: string; oldValue: string; newValue: string }> = [];

  // Compare basic fields
  if (oldDoc.type !== newDoc.type) {
    changes.push({ field: 'type', displayName: 'Type', oldValue: oldDoc.type, newValue: newDoc.type });
  }
  if (oldDoc.name !== newDoc.name) {
    changes.push({ field: 'name', displayName: 'Name', oldValue: oldDoc.name, newValue: newDoc.name });
  }
  if (oldDoc.content !== newDoc.content) {
    changes.push({
      field: 'content',
      displayName: 'Content',
      oldValue: oldDoc.content,
      newValue: newDoc.content,
    });
  }

  // Compare extra fields based on document type
  // Extra fields are specific to Type Specification, Scenario, Scenario Variation, and Needed Research
  const extraFieldMapping = getExtraFieldMappingForDocumentType(oldDoc.type);
  if (extraFieldMapping) {
    const oldDocRecord = oldDoc as unknown as Record<string, unknown>;
    const newDocRecord = newDoc as unknown as Record<string, unknown>;

    for (const [fieldKey, displayName] of Object.entries(extraFieldMapping)) {
      const oldValue = oldDocRecord[fieldKey];
      const newValue = newDocRecord[fieldKey];

      if (oldValue !== newValue) {
        const oldStr = formatFieldValue(oldValue);
        const newStr = formatFieldValue(newValue);

        changes.push({
          field: fieldKey,
          displayName,
          oldValue: oldStr,
          newValue: newStr,
        });
      }
    }
  }

  if (changes.length === 0) return null;

  return (
    <div className={`mt-2 rounded p-3 ${colors.changed.background} `}>
      <div className="mb-2 text-sm font-semibold">Field Changes</div>
      <div className="space-y-3">
        {changes.map((change) => (
          <div key={change.field} className="text-xs">
            <div className="font-medium text-gray-700">{change.displayName}:</div>
            <div className="ml-2 space-y-1">
              <div>
                <span className="font-medium text-gray-600">Changes:</span>
                <div className="mt-1">
                  <InlineTextDiff oldContent={change.oldValue} newContent={change.newValue} />
                </div>
                <div className="hidden">
                  <span className="font-medium text-red-600">Old:</span>
                  <pre className="bg-gray-100 p-2 text-xs">{JSON.stringify(change.oldValue, null, 2)}</pre>
                  <span className="font-medium text-green-600">New:</span>
                  <pre className="bg-gray-100 p-2 text-xs">{JSON.stringify(change.newValue, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Get the extra field mapping for a given document type.
 * Returns a mapping of field keys to display names.
 */
function getExtraFieldMappingForDocumentType(type: string): Record<string, string> | null {
  switch (type) {
    case 'Type Specification':
      return TYPE_SPECIFICATION_PROPERTY_MAPPING;
    case 'Scenario':
      return SCENARIO_PROPERTY_MAPPING;
    case 'Scenario Variation':
      return SCENARIO_VARIATION_PROPERTY_MAPPING;
    case 'Needed Research':
      return NEEDED_RESEARCH_PROPERTY_MAPPING;
    default:
      return null;
  }
}

/**
 * Format a field value for display.
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  return String(value);
}

/**
 * Display document content and extra fields in Atlas style.
 * Used for showing added/deleted documents in the diff UI.
 */
function DocumentContent({
  doc,
  uuidToDocNoMap,
}: {
  doc: { type: string; content: string };
  uuidToDocNoMap: Map<string, string>;
}) {
  const extraFieldMapping = getExtraFieldMappingForDocumentType(doc.type);
  const docRecord = doc as unknown as Record<string, unknown>;

  // Format markdown content as HTML for display (consistent with Atlas viewer)
  const formattedContent = markdownToHTML(doc.content, uuidToDocNoMap);

  return (
    <div className="space-y-3">
      {/* Document content in Atlas style */}
      {doc.content && (
        <div className="text-sm font-medium text-gray-800">
          <CustomHTML html={formattedContent} />
        </div>
      )}

      {/* Extra fields if present - styled like content-tree */}
      {extraFieldMapping && (
        <div className="mt-2 text-sm text-slate-600">
          {Object.entries(extraFieldMapping).map(([fieldKey, displayName]) => {
            const fieldValue = docRecord[fieldKey];
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
              // Format field value with markdown support
              let formattedValue: React.ReactNode;

              if (Array.isArray(fieldValue)) {
                // For arrays, join with comma and format as markdown
                const joinedValue = fieldValue.join(', ');
                const html = markdownToHTML(joinedValue, uuidToDocNoMap);
                formattedValue = <CustomHTML html={html} />;
              } else if (typeof fieldValue === 'string') {
                // For strings, format as markdown
                const html = markdownToHTML(fieldValue, uuidToDocNoMap);
                formattedValue = <CustomHTML html={html} />;
              } else {
                // For numbers and booleans, convert to string
                formattedValue = String(fieldValue);
              }

              return (
                <div key={fieldKey} className="mb-1">
                  <p className="font-semibold text-slate-700">{displayName}:</p>
                  <div>{formattedValue}</div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
