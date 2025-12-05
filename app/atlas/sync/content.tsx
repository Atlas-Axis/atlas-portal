'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from '@heroui/alert';
import { Divider } from '@heroui/divider';
import { Button, Card, CardBody, CardHeader, Checkbox, Chip, Progress } from '@heroui/react';
import { useRealtimeRun } from '@trigger.dev/react-hooks';
import TypeChip from '@/app/atlas/type-chip';
import { CustomHTML } from '@/app/components/custom-html';
import { InlineTextDiff } from '@/app/components/inline-text-diff';
import type { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import type { AtlasChangeType, AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import type { markdownNotionSyncTask } from '@/app/server/services/trigger/markdown-notion-sync-task';
import { getSyncStatus, requestSyncStop, triggerMarkdownNotionSync } from './_actions/sync-actions';
import { createPublicAccessToken } from './_actions/trigger-auth';

// Sync phase type matching the task
type SyncPhase =
  | 'initializing'
  | 'content'
  | 'additions'
  | 'mention_updates' // Phase 2.5: Update placeholder mentions with real Notion page IDs
  | 'deletions'
  | 'parent_changes'
  | 'notion_import' // Phase 6: Notion-to-Supabase import for affected databases
  | 'completed'
  | 'stopped';

// Metadata structure from the task
interface SyncMetadata {
  phase: SyncPhase;
  completed: number;
  total: number;
  currentDoc: string | null;
  succeeded: number;
  failed: number;
  skipped: number;
}

const colors: {
  [K in AtlasChangeType]: {
    background: string;
    border: string;
    text: string;
    sectionBackground: string;
  };
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

export function Content({ result, isDevMode }: { result: AtlasDiffResult; isDevMode: boolean }) {
  const { changes, originalIdsToDocuments, newIdsToDocuments, originalIdsToDatabase, newIdsToDatabase } = result;
  const hasChanges =
    changes.added.length > 0 ||
    changes.changed.length > 0 ||
    changes.parent_changed.length > 0 ||
    changes.deleted.length > 0;

  // Create UUID to document number map for markdown link conversion
  const uuidToDocNoMap = useMemo(() => {
    const map = new Map<string, string>();
    originalIdsToDocuments.forEach((doc, uuid) => {
      map.set(uuid, doc.doc_no);
    });
    newIdsToDocuments.forEach((doc, uuid) => {
      map.set(uuid, doc.doc_no);
    });
    return map;
  }, [originalIdsToDocuments, newIdsToDocuments]);

  // Create combined UUID to database map
  const uuidToDatabaseMap = useMemo(() => {
    const map = new Map<string, AtlasDatabaseName>();
    originalIdsToDatabase.forEach((db, uuid) => {
      map.set(uuid, db);
    });
    newIdsToDatabase.forEach((db, uuid) => {
      map.set(uuid, db);
    });
    return map;
  }, [originalIdsToDatabase, newIdsToDatabase]);

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
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
          uuidToDatabaseMap={uuidToDatabaseMap}
        />

        {/* Changed Documents */}
        <ChangeSection
          title="Changed"
          changes={changes.changed}
          changeType="changed"
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
          uuidToDatabaseMap={uuidToDatabaseMap}
        />

        {/* Parent Changed */}
        <ChangeSection
          title="Parent Changed"
          changes={changes.parent_changed}
          changeType="parent_changed"
          uuidToDocMap={newIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
          uuidToDatabaseMap={uuidToDatabaseMap}
        />

        {/* Deleted Documents */}
        <ChangeSection
          title="Deleted"
          changes={changes.deleted}
          changeType="deleted"
          uuidToDocMap={originalIdsToDocuments}
          uuidToDocNoMap={uuidToDocNoMap}
          uuidToDatabaseMap={uuidToDatabaseMap}
        />

        {/* Sync Controls */}
        <SyncControls hasChanges={hasChanges} isDevMode={isDevMode} />
      </CardBody>
    </Card>
  );
}

/**
 * Sync controls component - manages sync state and realtime subscription
 */
function SyncControls({ hasChanges, isDevMode }: { hasChanges: boolean; isDevMode: boolean }) {
  // Sync filter state
  const [syncFilters, setSyncFilters] = useState({
    added: true,
    deleted: false,
    contentChanges: false,
    parentChanges: false,
  });

  // Trigger state
  const [isStarting, setIsStarting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopRequested, setStopRequested] = useState(false);

  // Check for existing sync on mount
  useEffect(() => {
    const checkExistingSync = async () => {
      try {
        const status = await getSyncStatus();
        if (status.isLocked && status.triggerRunId) {
          // There's an existing sync running - subscribe to it
          const tokenResult = await createPublicAccessToken(status.triggerRunId);
          if ('error' in tokenResult) {
            console.error('Failed to create token for existing sync:', tokenResult.error);
            return;
          }
          setRunId(status.triggerRunId);
          setAccessToken(tokenResult.token);
          setStopRequested(status.stopRequested);
        }
      } catch (err) {
        console.error('Failed to check existing sync:', err);
      }
    };
    checkExistingSync();
  }, []);

  const handleSyncClick = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setStopRequested(false);

    try {
      // Trigger the sync task
      const result = await triggerMarkdownNotionSync({
        added: syncFilters.added,
        deleted: syncFilters.deleted,
        contentChanges: syncFilters.contentChanges,
        parentChanges: syncFilters.parentChanges,
      });

      if ('error' in result) {
        setError(result.error);
        setIsStarting(false);
        return;
      }

      // Create public access token for realtime subscription
      const tokenResult = await createPublicAccessToken(result.runId);
      if ('error' in tokenResult) {
        setError(tokenResult.error);
        setIsStarting(false);
        return;
      }

      setRunId(result.runId);
      setAccessToken(tokenResult.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsStarting(false);
    }
  }, [syncFilters]);

  const handleStopClick = useCallback(async () => {
    setStopRequested(true);
    try {
      const result = await requestSyncStop();
      if (!result.success) {
        setError(result.error || 'Failed to request stop');
        setStopRequested(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setStopRequested(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setRunId(null);
    setAccessToken(null);
    setError(null);
    setStopRequested(false);
    setIsRunCompleted(false);
  }, []);

  const handleRunStatusChange = useCallback((completed: boolean) => {
    setIsRunCompleted(completed);
  }, []);

  // Track whether the sync run has completed (to hide Stop button)
  const [isRunCompleted, setIsRunCompleted] = useState(false);

  // Whether any filters are enabled
  const hasEnabledFilters =
    syncFilters.added || syncFilters.deleted || syncFilters.contentChanges || syncFilters.parentChanges;

  // Whether controls should be disabled
  const isRunning = !!runId;
  const controlsDisabled = isStarting || isRunning;

  return (
    <div className="my-6">
      {/* Sync Filters */}
      <div className="mb-4 flex justify-center gap-6">
        <Checkbox
          isSelected={syncFilters.added}
          onValueChange={(checked) => setSyncFilters((prev) => ({ ...prev, added: checked }))}
          isDisabled={controlsDisabled}
        >
          Added
        </Checkbox>
        <Checkbox
          isSelected={syncFilters.deleted}
          onValueChange={(checked) => setSyncFilters((prev) => ({ ...prev, deleted: checked }))}
          isDisabled={controlsDisabled}
        >
          Deleted
        </Checkbox>
        <Checkbox
          isSelected={syncFilters.contentChanges}
          onValueChange={(checked) => setSyncFilters((prev) => ({ ...prev, contentChanges: checked }))}
          isDisabled={controlsDisabled}
        >
          Content Changes
        </Checkbox>
        <Checkbox
          isSelected={syncFilters.parentChanges}
          onValueChange={(checked) => setSyncFilters((prev) => ({ ...prev, parentChanges: checked }))}
          isDisabled={controlsDisabled}
        >
          Parent Changes
        </Checkbox>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="faded" color="danger" className="mx-auto mb-4 max-w-lg">
          {error}
        </Alert>
      )}

      {/* Sync Buttons */}
      <div className="flex justify-center gap-3">
        {!isRunning ? (
          <Button
            size="lg"
            onPress={handleSyncClick}
            variant="solid"
            color="primary"
            isLoading={isStarting}
            isDisabled={controlsDisabled || !hasChanges || !hasEnabledFilters}
          >
            Sync Changes to Notion
          </Button>
        ) : (
          <>
            {isDevMode && !stopRequested && !isRunCompleted && (
              <Button size="lg" onPress={handleStopClick} variant="bordered" color="warning">
                Stop Sync
              </Button>
            )}
          </>
        )}
      </div>

      {/* Realtime Progress Display */}
      {runId && accessToken && (
        <SyncProgressDisplay
          runId={runId}
          accessToken={accessToken}
          stopRequested={stopRequested}
          onComplete={handleReset}
          onStatusChange={handleRunStatusChange}
        />
      )}
    </div>
  );
}

/**
 * Realtime progress display using Trigger.dev subscription
 */
function SyncProgressDisplay({
  runId,
  accessToken,
  stopRequested,
  onComplete,
  onStatusChange,
}: {
  runId: string;
  accessToken: string;
  stopRequested: boolean;
  onComplete: () => void;
  onStatusChange: (completed: boolean) => void;
}) {
  const { run, error } = useRealtimeRun<typeof markdownNotionSyncTask>(runId, {
    accessToken,
    onComplete: () => {
      // Don't auto-reset - let user see final state
    },
  });

  // Extract sync metadata
  const syncMetadata = run?.metadata?.sync as SyncMetadata | undefined;
  const phase = syncMetadata?.phase ?? 'initializing';
  const completed = syncMetadata?.completed ?? 0;
  const total = syncMetadata?.total ?? 0;
  const currentDoc = syncMetadata?.currentDoc ?? null;
  const succeeded = syncMetadata?.succeeded ?? 0;
  const failed = syncMetadata?.failed ?? 0;
  const skipped = syncMetadata?.skipped ?? 0;

  const isCompleted = run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED';
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  // Notify parent when completion status changes
  useEffect(() => {
    onStatusChange(isCompleted);
  }, [isCompleted, onStatusChange]);

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      {/* Error from subscription */}
      {error && (
        <Alert variant="faded" color="danger" className="mb-4">
          Subscription error: {error.message}
        </Alert>
      )}

      {/* Phase and Progress */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Sync Progress:</span>
            <PhaseChip phase={phase} />
            {stopRequested && phase !== 'stopped' && phase !== 'completed' && (
              <Chip color="warning" size="sm">
                Stopping...
              </Chip>
            )}
            {run?.status && (
              <Chip
                size="sm"
                color={
                  run.status === 'COMPLETED'
                    ? 'success'
                    : run.status === 'FAILED'
                      ? 'danger'
                      : run.status === 'CANCELED'
                        ? 'warning'
                        : 'primary'
                }
              >
                {run.status}
              </Chip>
            )}
          </div>
          <span className="text-sm text-gray-600">
            {completed} / {total}
          </span>
        </div>
        <Progress value={progressPercent} color={isCompleted ? 'success' : 'primary'} className="max-w-full" />
      </div>

      {/* Current Document */}
      {currentDoc && (
        <div className="mb-4 text-sm text-gray-700">
          <span className="font-medium">Processing:</span> {currentDoc}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mb-4 flex gap-4 text-sm">
        <span className="text-green-700">✓ Succeeded: {succeeded}</span>
        <span className="text-red-700">✗ Failed: {failed}</span>
        <span className="text-yellow-700">⊘ Skipped: {skipped}</span>
      </div>

      {/* Task Output (on completion) */}
      {isCompleted && run?.output && (
        <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 font-semibold">Final Result:</div>
          <div className="text-sm">
            <span className="text-green-700">Succeeded: {run.output.succeeded}</span>
            {' | '}
            <span className="text-red-700">Failed: {run.output.failed}</span>
            {' | '}
            <span className="text-yellow-700">Skipped: {run.output.skipped}</span>
            {run.output.stoppedEarly && <span className="ml-2 text-orange-600">(Stopped early)</span>}
          </div>
          {(run.output as { error?: string }).error && (
            <div className="mt-2 text-red-600">Error: {(run.output as { error?: string }).error}</div>
          )}
        </div>
      )}

      {/* Reset Button (on completion) */}
      {isCompleted && (
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="bordered" onPress={onComplete}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}

function PhaseChip({ phase }: { phase: SyncPhase }) {
  const phaseLabels: Record<SyncPhase, string> = {
    initializing: 'Initializing',
    content: 'Content Changes',
    additions: 'Additions',
    mention_updates: 'Mention Updates',
    deletions: 'Deletions',
    parent_changes: 'Parent Changes',
    notion_import: 'Notion Import',
    completed: 'Completed',
    stopped: 'Stopped',
  };

  const phaseColors: Record<SyncPhase, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
    initializing: 'default',
    content: 'primary',
    additions: 'success',
    mention_updates: 'primary',
    deletions: 'danger',
    parent_changes: 'warning',
    notion_import: 'primary',
    completed: 'success',
    stopped: 'warning',
  };

  return (
    <Chip size="sm" color={phaseColors[phase]}>
      {phaseLabels[phase]}
    </Chip>
  );
}

const ChangeSection = memo(function ChangeSection({
  title,
  changes,
  changeType,
  uuidToDocMap,
  uuidToDocNoMap,
  uuidToDatabaseMap,
}: {
  title: string;
  changes: AtlasDocumentChange[];
  changeType: AtlasChangeType;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
  uuidToDocNoMap: Map<string, string>;
  uuidToDatabaseMap: Map<string, AtlasDatabaseName>;
}) {
  const colorConfig = colors[changeType];

  if (changes.length === 0) {
    return null;
  }

  return (
    <div className="my-9">
      <div className={`-mx-3 my-3 mb-6 rounded-md ${colorConfig.sectionBackground} p-3 text-white`}>
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
            uuidToDatabaseMap={uuidToDatabaseMap}
          />
        ))}
      </div>
    </div>
  );
});

// Format UUID as document reference
function formatDocReference(
  uuid: string,
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>,
): string {
  const refDoc = uuidToDocMap.get(uuid);
  if (refDoc) {
    return `${refDoc.doc_no} - ${refDoc.name} [${refDoc.type}]`;
  }
  return uuid;
}

const ChangeCard = memo(function ChangeCard({
  change,
  uuidToDocMap,
  uuidToDocNoMap,
  uuidToDatabaseMap,
}: {
  change: AtlasDocumentChange;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
  uuidToDocNoMap: Map<string, string>;
  uuidToDatabaseMap: Map<string, AtlasDatabaseName>;
}) {
  const doc = change.newValues ?? change.oldValues;
  if (!doc) return null;

  const databaseName = uuidToDatabaseMap.get(change.uuid);

  return (
    <div className="flex items-center gap-3">
      <Card className="flex-1" radius="none" shadow="none">
        <CardBody className="flex flex-col gap-0">
          {/* Document title in Atlas style */}
          <div className="flex items-center gap-2 text-base font-semibold">
            <span>
              {doc.doc_no} - {doc.name}
            </span>
            <TypeChip type={doc.type} />
            {databaseName && (
              <Chip size="sm" variant="flat" color="default" className="text-xs">
                {databaseName}
              </Chip>
            )}
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
});

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

  // Format markdown content as HTML for display
  const formattedContent = markdownToHTML(doc.content, uuidToDocNoMap);

  return (
    <div className="space-y-3">
      {/* Document content in Atlas style */}
      {doc.content && (
        <div className="text-sm font-medium text-gray-800">
          <CustomHTML html={formattedContent} />
        </div>
      )}

      {/* Extra fields if present */}
      {extraFieldMapping && (
        <div className="mt-2 text-sm text-slate-600">
          {Object.entries(extraFieldMapping).map(([fieldKey, displayName]) => {
            const fieldValue = docRecord[fieldKey];
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
              let formattedValue: React.ReactNode;

              if (Array.isArray(fieldValue)) {
                const joinedValue = fieldValue.join(', ');
                const html = markdownToHTML(joinedValue, uuidToDocNoMap);
                formattedValue = <CustomHTML html={html} />;
              } else if (typeof fieldValue === 'string') {
                const html = markdownToHTML(fieldValue, uuidToDocNoMap);
                formattedValue = <CustomHTML html={html} />;
              } else {
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
