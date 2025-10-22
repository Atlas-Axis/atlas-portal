'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@heroui/input';
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { Search } from 'lucide-react';
import type { ChildCollectionName, StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { childCollectionNames } from '@/app/server/atlas/json-export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { typeColorMap } from '@/app/server/atlas/type-color-map';
import { dispatchExpandScopeEvent } from './custom-events';

interface SearchModalProps {
  scopeTrees: StandardizedAtlasDocument[];
  uuidMappings: UuidMappings;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Type guard to check if a property exists on an object
 */
function hasChildCollection(
  doc: StandardizedAtlasDocument,
  collectionName: ChildCollectionName,
): doc is StandardizedAtlasDocument & Record<ChildCollectionName, StandardizedAtlasDocument[]> {
  return collectionName in doc && Array.isArray((doc as unknown as Record<string, unknown>)[collectionName]);
}

/**
 * Recursively flattens the scopeTrees hierarchy into a flat array of all documents
 * including all supporting documents (annotations, tenets, scenarios, etc.)
 */
function flattenDocuments(docs: StandardizedAtlasDocument[]): StandardizedAtlasDocument[] {
  const result: StandardizedAtlasDocument[] = [];

  function traverse(doc: StandardizedAtlasDocument) {
    result.push(doc);

    // Check all possible child collections using the exported constant
    for (const collectionName of childCollectionNames) {
      if (hasChildCollection(doc, collectionName)) {
        const children = doc[collectionName];
        if (Array.isArray(children)) {
          children.forEach((child) => traverse(child));
        }
      }
    }
  }

  docs.forEach((doc) => traverse(doc));
  return result;
}

/**
 * Truncates text to specified length and adds ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export default function SearchModal({ scopeTrees, uuidMappings, isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');

  // Flatten all documents once on mount
  const allDocuments = useMemo(() => flattenDocuments(scopeTrees), [scopeTrees]);

  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return [];

    const results = allDocuments.filter((doc) => {
      const docNo = (doc.doc_no || '').toLowerCase();
      const name = (doc.name || '').toLowerCase();
      const content = (doc.content || '').toLowerCase();

      return docNo.includes(trimmedQuery) || name.includes(trimmedQuery) || content.includes(trimmedQuery);
    });

    // Limit to top 50 results for performance
    return results.slice(0, 50);
  }, [query, allDocuments]);

  // Focus input when modal opens and handle keyboard navigation
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Small delay to ensure modal animation completes
      setTimeout(() => {
        const input = document.querySelector('[data-search-modal-input]') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleResultClick = (doc: StandardizedAtlasDocument) => {
    const docNo = doc.doc_no;
    if (!docNo) {
      console.warn('Cannot navigate to document without doc_no:', doc);
      return;
    }

    // Extract root scope from document ID (e.g., A.2.9 -> A.2)
    const rootScopeDocID = docNo.split('.').slice(0, 2).join('.');

    // Close modal
    onClose();

    // Navigate to hash
    window.location.hash = docNo;

    // Trigger expansion of the target scope
    setTimeout(() => {
      dispatchExpandScopeEvent({
        scopeDocID: rootScopeDocID,
        targetDocID: docNo,
      });
    }, 100);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      placement="top"
      classNames={{
        base: 'mt-20',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-slate-200 pb-4">
          <Input
            data-search-modal-input
            placeholder="Search Atlas documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            startContent={<Search className="h-4 w-4 text-slate-400" />}
            classNames={{
              input: 'text-lg',
              inputWrapper: 'h-12',
            }}
            autoFocus
          />
        </ModalHeader>
        <ModalBody className="py-4">
          {!query.trim() && (
            <div className="py-12 text-center text-slate-500">
              <Search className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p>Start typing to search across all Atlas documents</p>
              <p className="mt-1 text-sm text-slate-400">Search by document number, title, or content</p>
            </div>
          )}

          {query.trim() && filteredDocuments.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <p>No documents found matching &quot;{query}&quot;</p>
            </div>
          )}

          {query.trim() && filteredDocuments.length > 0 && (
            <div className="space-y-1">
              <p className="mb-3 text-sm text-slate-500">
                {filteredDocuments.length === 50
                  ? '50+ results (showing first 50)'
                  : `${filteredDocuments.length} result${filteredDocuments.length === 1 ? '' : 's'}`}
              </p>
              {filteredDocuments.map((doc, idx) => {
                const notionId = doc.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(doc.uuid) : null;
                const key = notionId || doc.doc_no || `result-${idx}`;

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleResultClick(doc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleResultClick(doc);
                      }
                    }}
                    className="cursor-pointer rounded-lg bg-slate-100 p-3 transition-all hover:bg-blue-100 focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none"
                    aria-label={`Navigate to ${doc.name || 'Untitled'} (${doc.doc_no || 'No document number'})`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {doc.doc_no && (
                        <span className="inline-block rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                          {doc.doc_no}
                        </span>
                      )}
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${typeColorMap[doc.type]}`}
                      >
                        {doc.type}
                      </span>
                    </div>
                    <div className="mb-1 font-semibold text-slate-900">{doc.name || '<Untitled>'}</div>
                    {doc.content && <div className="text-sm text-slate-600">{truncateText(doc.content, 150)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
