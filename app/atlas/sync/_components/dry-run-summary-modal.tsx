'use client';

import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { AtlasChangeType } from '@/app/server/atlas/diff/atlas-diff';
import { cn } from '@/app/shared/utils/utils';
import type { DryRunOperation, DryRunResult } from '../_lib/sync-orchestrator';

interface DryRunSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  result: DryRunResult | null;
}

const operationColors: Record<string, { background: string; text: string }> = {
  create: { background: 'bg-green-100', text: 'text-green-800' },
  update: { background: 'bg-blue-100', text: 'text-blue-800' },
  archive: { background: 'bg-red-100', text: 'text-red-800' },
};

const changeTypeLabels: Record<AtlasChangeType, string> = {
  added: 'New',
  changed: 'Content Change',
  deleted: 'Delete',
  parent_changed: 'Parent Change',
  sibling_order_changed: 'Order Change',
};

const changeTypeColors: Record<AtlasChangeType, { background: string; text: string }> = {
  added: { background: 'bg-green-50', text: 'text-green-700' },
  changed: { background: 'bg-blue-50', text: 'text-blue-700' },
  deleted: { background: 'bg-red-50', text: 'text-red-700' },
  parent_changed: { background: 'bg-orange-50', text: 'text-orange-700' },
  sibling_order_changed: { background: 'bg-yellow-50', text: 'text-yellow-700' },
};

export function DryRunSummaryModal({ isOpen, onClose, onProceed, result }: DryRunSummaryModalProps) {
  if (!result) return null;

  const { operations, summary, truncated } = result;

  // Group operations by type (these are already limited to MAX_OPERATIONS_PER_TYPE)
  const createOps = operations.filter((op) => op.operationType === 'create');
  const updateOps = operations.filter((op) => op.operationType === 'update' && !op.skipped);
  const archiveOps = operations.filter((op) => op.operationType === 'archive');
  const skippedOps = operations.filter((op) => op.skipped);

  const hasOperations = summary.createCount + summary.updateCount + summary.archiveCount > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside" placement="center">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-semibold">Dry-Run Preview</h2>
          <p className="text-sm font-normal text-slate-500">
            The following operations would be performed when you sync changes to Notion.
          </p>
        </ModalHeader>

        <ModalBody className="py-4">
          {/* Summary Counts - use summary from server for accurate counts */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <SummaryCard title="Create" count={summary.createCount} color="green" />
            <SummaryCard title="Update" count={summary.updateCount} color="blue" />
            <SummaryCard title="Archive" count={summary.archiveCount} color="red" />
            <SummaryCard title="Skipped" count={summary.skippedCount} color="yellow" />
          </div>

          {/* Truncation notice */}
          {truncated && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Note:</strong> Showing first 50 items per category. Total operations: {summary.totalCount}
            </div>
          )}

          {!hasOperations && summary.skippedCount === 0 && (
            <div className="py-8 text-center text-slate-500">
              <p>No operations would be performed.</p>
            </div>
          )}

          {/* Operations by Type */}
          {createOps.length > 0 && (
            <OperationSection
              title="Pages to Create"
              operations={createOps}
              operationType="create"
              totalCount={summary.createCount}
            />
          )}

          {updateOps.length > 0 && (
            <OperationSection
              title="Pages to Update"
              operations={updateOps}
              operationType="update"
              totalCount={summary.updateCount}
            />
          )}

          {archiveOps.length > 0 && (
            <OperationSection
              title="Pages to Archive"
              operations={archiveOps}
              operationType="archive"
              totalCount={summary.archiveCount}
            />
          )}

          {skippedOps.length > 0 && (
            <OperationSection
              title="Skipped Operations"
              operations={skippedOps}
              operationType="skipped"
              totalCount={summary.skippedCount}
              showSkipReason
            />
          )}
        </ModalBody>

        <ModalFooter className="border-t border-slate-200 pt-4">
          <Button variant="bordered" onPress={onClose}>
            Close
          </Button>
          {hasOperations && (
            <Button color="primary" onPress={onProceed}>
              Proceed with Sync
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SummaryCard({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: 'green' | 'blue' | 'red' | 'yellow';
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  return (
    <div className={cn('rounded-lg border p-4 text-center', colorClasses[color])}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-sm">{title}</div>
    </div>
  );
}

function OperationSection({
  title,
  operations,
  operationType,
  totalCount,
  showSkipReason = false,
}: {
  title: string;
  operations: DryRunOperation[];
  operationType: 'create' | 'update' | 'archive' | 'skipped';
  totalCount: number;
  showSkipReason?: boolean;
}) {
  const headerColors = {
    create: 'bg-green-600',
    update: 'bg-blue-600',
    archive: 'bg-red-600',
    skipped: 'bg-yellow-600',
  };

  const isTruncated = operations.length < totalCount;

  return (
    <div className="mb-6">
      <div className={cn('mb-3 rounded-md px-3 py-2 text-white', headerColors[operationType])}>
        <h3 className="font-semibold">
          {title} ({totalCount})
          {isTruncated && <span className="ml-2 text-sm font-normal opacity-80">showing {operations.length}</span>}
        </h3>
      </div>
      <div className="space-y-2">
        {operations.map((op, idx) => (
          <OperationRow key={`${op.documentId}-${idx}`} operation={op} showSkipReason={showSkipReason} />
        ))}
      </div>
    </div>
  );
}

function OperationRow({ operation, showSkipReason }: { operation: DryRunOperation; showSkipReason?: boolean }) {
  const colors = operation.skipped
    ? { background: 'bg-yellow-50', text: 'text-yellow-800' }
    : operationColors[operation.operationType];

  return (
    <div className={cn('rounded-md border border-slate-200 p-3', colors.background)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', colors.text)}>{operation.documentLabel}</span>
          <Chip
            size="sm"
            className={cn(
              changeTypeColors[operation.changeType].background,
              changeTypeColors[operation.changeType].text,
            )}
          >
            {changeTypeLabels[operation.changeType]}
          </Chip>
        </div>
        <span className="text-xs text-slate-500">{operation.databaseName}</span>
      </div>
      {showSkipReason && operation.skipReason && (
        <div className="mt-2 text-sm text-yellow-700">
          <span className="font-medium">Reason:</span> {operation.skipReason}
        </div>
      )}
    </div>
  );
}
