import { InlineTextDiff } from '@/app/components/inline-text-diff';
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/atlas-diff';
import type { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';

export default async function AtlasSyncPage() {
  const result = await diffAtlasScopeTreeLists();
  const { changes } = result;

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Atlas Sync - Changes Detection</h1>

      <div className="mb-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
        <h2 className="mb-2 text-xl font-semibold">Summary</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Added</div>
            <div className="text-2xl font-bold text-green-600">{changes.added.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Changed</div>
            <div className="text-2xl font-bold text-blue-600">{changes.changed.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Sibling Order</div>
            <div className="text-2xl font-bold text-yellow-600">{changes.sibling_order_changed.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Parent Changed</div>
            <div className="text-2xl font-bold text-orange-600">{changes.parent_changed.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Deleted</div>
            <div className="text-2xl font-bold text-red-600">{changes.deleted.length}</div>
          </div>
        </div>
      </div>

      {/* Added Documents */}
      <ChangeSection
        title="Added Documents"
        changes={changes.added}
        colorClass="border-green-500"
        emptyMessage="No documents added"
      />

      {/* Changed Documents */}
      <ChangeSection
        title="Changed Documents"
        changes={changes.changed}
        colorClass="border-blue-500"
        emptyMessage="No documents changed"
      />

      {/* Sibling Order Changed */}
      <ChangeSection
        title="Sibling Order Changed"
        changes={changes.sibling_order_changed}
        colorClass="border-yellow-500"
        emptyMessage="No sibling order changes"
      />

      {/* Parent Changed */}
      <ChangeSection
        title="Parent Changed"
        changes={changes.parent_changed}
        colorClass="border-orange-500"
        emptyMessage="No parent changes"
      />

      {/* Deleted Documents */}
      <ChangeSection
        title="Deleted Documents"
        changes={changes.deleted}
        colorClass="border-red-500"
        emptyMessage="No documents deleted"
      />
    </div>
  );
}

function ChangeSection({
  title,
  changes,
  colorClass,
  emptyMessage,
}: {
  title: string;
  changes: AtlasDocumentChange[];
  colorClass: string;
  emptyMessage: string;
}) {
  if (changes.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
        <p className="text-gray-500 italic dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="mb-4 text-2xl font-semibold">
        {title} ({changes.length})
      </h2>
      <div className="space-y-4">
        {changes.map((change, index) => (
          <ChangeCard key={`${change.uuid}-${index}`} change={change} colorClass={colorClass} />
        ))}
      </div>
    </div>
  );
}

function ChangeCard({ change, colorClass }: { change: AtlasDocumentChange; colorClass: string }) {
  const doc = change.newValues ?? change.oldValues;
  if (!doc) return null;

  return (
    <div className={`border-l-4 ${colorClass} rounded bg-white p-4 shadow dark:bg-gray-900`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="font-mono text-sm text-gray-500 dark:text-gray-400">{change.uuid}</div>
            <div className="text-lg font-semibold">{doc.name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Type: <span className="font-medium">{doc.type}</span> | Doc No:{' '}
              <span className="font-medium">{doc.doc_no}</span>
            </div>
          </div>
        </div>

        {/* Show old and new values for changes */}
        {change.changeType === 'changed' && change.oldValues && change.newValues && (
          <FieldChanges oldDoc={change.oldValues} newDoc={change.newValues} />
        )}

        {/* Show parent change details */}
        {change.changeType === 'parent_changed' && (
          <div className="mt-2 rounded bg-orange-50 p-3 dark:bg-orange-900/20">
            <div className="mb-1 text-sm font-semibold">Parent Changed</div>
            <div className="space-y-1 text-xs">
              <div>
                <span className="font-medium">Old doc_no:</span> {change.oldValues?.doc_no}
              </div>
              <div>
                <span className="font-medium">New doc_no:</span> {change.newValues?.doc_no}
              </div>
              <div>
                <span className="font-medium">Old ancestry:</span> {change.oldAncestry?.join(' → ') || 'root'}
              </div>
              <div>
                <span className="font-medium">New ancestry:</span> {change.newAncestry?.join(' → ') || 'root'}
              </div>
            </div>
          </div>
        )}

        {/* Show sibling order change details */}
        {change.changeType === 'sibling_order_changed' && (
          <div className="mt-2 rounded bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <div className="mb-1 text-sm font-semibold">Sibling Order Changed</div>
            <div className="text-xs">
              <span className="font-medium">Old doc_no:</span> {change.oldValues?.doc_no} →{' '}
              <span className="font-medium">New doc_no:</span> {change.newValues?.doc_no}
            </div>
          </div>
        )}

        {/* Show ancestry for added documents */}
        {change.changeType === 'added' && change.newAncestry && change.newAncestry.length > 0 && (
          <div className="mt-2 rounded bg-green-50 p-3 dark:bg-green-900/20">
            <div className="text-xs">
              <span className="font-medium">Ancestry:</span> {change.newAncestry.join(' → ')}
            </div>
          </div>
        )}

        {/* Show ancestry for deleted documents */}
        {change.changeType === 'deleted' && change.oldAncestry && change.oldAncestry.length > 0 && (
          <div className="mt-2 rounded bg-red-50 p-3 dark:bg-red-900/20">
            <div className="text-xs">
              <span className="font-medium">Ancestry:</span> {change.oldAncestry.join(' → ')}
            </div>
          </div>
        )}
      </div>
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
    <div className="mt-2 rounded bg-blue-50 p-3 dark:bg-blue-900/20">
      <div className="mb-2 text-sm font-semibold">Field Changes</div>
      <div className="space-y-3">
        {changes.map((change) => (
          <div key={change.field} className="text-xs">
            <div className="font-medium text-gray-700 dark:text-gray-300">{change.displayName}:</div>
            <div className="ml-2 space-y-1">
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Changes:</span>
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
