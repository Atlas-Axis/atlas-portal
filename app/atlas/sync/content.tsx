'use client';

import { Alert } from '@heroui/alert';
import { Checkbox } from '@heroui/checkbox';
import { Divider } from '@heroui/divider';
import { Card, CardBody, CardHeader } from '@heroui/react';
import TypeChip from '@/app/atlas/type-chip';
import { CustomHTML } from '@/app/components/custom-html';
import { InlineTextDiff } from '@/app/components/inline-text-diff';
import type { AtlasChangeType, AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import { cn } from '@/app/shared/utils/utils';

const colors: { [K in AtlasChangeType]: { background: string; border: string; text: string } } = {
  added: {
    background: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-800',
  },
  changed: {
    background: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-800',
  },
  sibling_order_changed: {
    background: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-800',
  },
  parent_changed: {
    background: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-800',
  },
  deleted: {
    background: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-800',
  },
};

export function Content({ result }: { result: AtlasDiffResult }) {
  const { changes, originalIdsToDocuments, newIdsToDocuments } = result;
  const hasChanges =
    changes.added.length > 0 ||
    changes.changed.length > 0 ||
    changes.sibling_order_changed.length > 0 ||
    changes.parent_changed.length > 0 ||
    changes.deleted.length > 0;

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
          title="Added Documents"
          changes={changes.added}
          changeType="added"
          emptyMessage="No documents added"
          uuidToDocMap={newIdsToDocuments}
        />

        {/* Changed Documents */}
        <ChangeSection
          title="Changed Documents"
          changes={changes.changed}
          changeType="changed"
          emptyMessage="No document content changes"
          uuidToDocMap={newIdsToDocuments}
        />

        {/* Sibling Order Changed */}
        <ChangeSection
          title="Sibling Order Changed"
          changes={changes.sibling_order_changed}
          changeType="sibling_order_changed"
          emptyMessage="No sibling order changes"
          uuidToDocMap={newIdsToDocuments}
        />

        {/* Parent Changed */}
        <ChangeSection
          title="Parent Changed"
          changes={changes.parent_changed}
          changeType="parent_changed"
          emptyMessage="No parent changes"
          uuidToDocMap={newIdsToDocuments}
        />

        {/* Deleted Documents */}
        <ChangeSection
          title="Deleted Documents"
          changes={changes.deleted}
          changeType="deleted"
          emptyMessage="No documents deleted"
          uuidToDocMap={originalIdsToDocuments}
        />
      </CardBody>
    </Card>
  );
}

function ChangeSection({
  title,
  changes,
  changeType,
  emptyMessage,
  uuidToDocMap,
}: {
  title: string;
  changes: AtlasDocumentChange[];
  changeType: AtlasChangeType;
  emptyMessage: string;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
}) {
  const colorConfig = colors[changeType];

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

  return (
    <div className="my-9">
      <h2 className="my-3 mb-6 rounded-md bg-slate-100 p-3 text-2xl font-semibold">
        {title} ({changes.length})
      </h2>
      <div>
        {changes.map((change, index) => (
          <ChangeCard key={`${change.uuid}-${index}`} change={change} uuidToDocMap={uuidToDocMap} />
        ))}
      </div>
    </div>
  );
}

function ChangeCard({
  change,
  uuidToDocMap,
}: {
  change: AtlasDocumentChange;
  uuidToDocMap: Map<string, { type: string; doc_no: string; name: string }>;
}) {
  const doc = change.newValues ?? change.oldValues;
  if (!doc) return null;

  // Format UUID as document reference
  const formatDocReference = (uuid: string) => {
    const refDoc = uuidToDocMap.get(uuid);
    if (refDoc) {
      return `${refDoc.doc_no} - ${refDoc.name} [${refDoc.type}]`;
    }
    return uuid; // Fallback to UUID if not found
  };

  return (
    <div className="flex items-center gap-3">
      <Checkbox size="lg" defaultSelected className="mt-1" />
      <Card className="flex-1" radius="none" shadow="none">
        <CardBody className="flex flex-col gap-0">
          {/* Document title in Atlas style */}
          <div className="flex items-center gap-2 text-base font-semibold">
            <span>
              {doc.doc_no} - {doc.name}
            </span>
            <TypeChip type={doc.type} />
          </div>

          {/* Show old and new values for changes */}
          {change.changeType === 'changed' && change.oldValues && change.newValues && (
            <FieldChanges oldDoc={change.oldValues} newDoc={change.newValues} />
          )}

          {/* Show parent change details */}
          {change.changeType === 'parent_changed' && (
            <div className={`mt-2 rounded p-3 ${colors.parent_changed.background} `}>
              <div className="mb-1 text-sm font-semibold">Parent Changed</div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-medium">Old doc_no:</span> {change.oldValues?.doc_no}
                </div>
                <div>
                  <span className="font-medium">New doc_no:</span> {change.newValues?.doc_no}
                </div>
                <div>
                  <span className="font-medium">Old parent:</span>{' '}
                  {change.oldAncestry && change.oldAncestry.length > 0
                    ? formatDocReference(change.oldAncestry[0])
                    : 'root'}
                </div>
                <div>
                  <span className="font-medium">New parent:</span>{' '}
                  {change.newAncestry && change.newAncestry.length > 0
                    ? formatDocReference(change.newAncestry[0])
                    : 'root'}
                </div>
              </div>
            </div>
          )}

          {/* Show sibling order change details */}
          {change.changeType === 'sibling_order_changed' && (
            <div className={`mt-2 rounded p-3 ${colors.sibling_order_changed.background} `}>
              <div className="mb-1 text-sm font-semibold">Sibling Order Changed</div>
              <div className="text-xs">
                <span className="font-medium">Old doc_no:</span> {change.oldValues?.doc_no} →{' '}
                <span className="font-medium">New doc_no:</span> {change.newValues?.doc_no}
              </div>
            </div>
          )}

          {/* Show content and extra fields for added documents */}
          {change.changeType === 'added' && change.newValues && (
            <div className="mt-2">
              <div className={`rounded p-3 ${colors.added.background} `}>
                <DocumentContent doc={change.newValues} />
              </div>
              {change.newAncestry && change.newAncestry.length > 0 && (
                <div className="mt-2 flex justify-end text-xs text-slate-400">
                  <span className="font-medium">Parent:</span> {formatDocReference(change.newAncestry[0])}
                </div>
              )}
            </div>
          )}

          {/* Show content and extra fields for deleted documents */}
          {change.changeType === 'deleted' && change.oldValues && (
            <div className="mt-2">
              <div className={`mt-2 rounded p-3 ${colors.deleted.background} `}>
                <DocumentContent doc={change.oldValues} />
              </div>
              {change.oldAncestry && change.oldAncestry.length > 0 && (
                <div className="mt-2 flex justify-end text-xs text-slate-400">
                  <span className="font-medium">Parent:</span> {formatDocReference(change.oldAncestry[0])}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
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
 */
function DocumentContent({ doc }: { doc: { type: string; content: string } }) {
  const extraFieldMapping = getExtraFieldMappingForDocumentType(doc.type);
  const docRecord = doc as unknown as Record<string, unknown>;

  // Format content as HTML like in content-tree
  const formattedContent = markdownToHTML(doc.content);

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
              return (
                <div key={fieldKey} className="mb-1">
                  <p className="font-semibold text-slate-700">{displayName}:</p>
                  <p>{Array.isArray(fieldValue) ? fieldValue.join(', ') : String(fieldValue)}</p>
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
