'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { Search } from 'lucide-react';
import type { ChildCollectionName, ExportAtlasTreeDocument } from '@/app/server/atlas/export/types';
import { childCollectionNames, extraFieldsByDocumentType } from '@/app/server/atlas/export/types';
import { typeColorMap } from '@/app/server/atlas/formatters/type-color-map';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { dispatchExpandScopeEvent } from './custom-events';

interface SearchModalProps {
  scopeTrees: ExportAtlasTreeDocument[];
  uuidMappings: UuidMappings;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Result type that includes the document and information about which field matched
 */
interface SearchResult {
  doc: ExportAtlasTreeDocument;
  matchedField?: 'doc_no' | 'name' | 'content' | string; // string for extra field keys
  matchedFieldLabel?: string; // Human-readable label for extra fields
  matchedFieldValue?: string; // Value of the matched extra field
}

/**
 * Type guard to check if a property exists on an object
 */
function hasChildCollection(
  doc: ExportAtlasTreeDocument,
  collectionName: ChildCollectionName,
): doc is ExportAtlasTreeDocument & Record<ChildCollectionName, ExportAtlasTreeDocument[]> {
  return collectionName in doc && Array.isArray((doc as unknown as Record<string, unknown>)[collectionName]);
}

/**
 * Get the property mapping for a document type to convert field keys to human-readable labels
 */
function getPropertyMappingForDocumentType(docType: string): Record<string, string> | null {
  switch (docType) {
    case 'Type Specification':
      return TYPE_SPECIFICATION_PROPERTY_MAPPING as unknown as Record<string, string>;
    case 'Scenario':
      return SCENARIO_PROPERTY_MAPPING as unknown as Record<string, string>;
    case 'Scenario Variation':
      return SCENARIO_VARIATION_PROPERTY_MAPPING as unknown as Record<string, string>;
    case 'Needed Research':
      return NEEDED_RESEARCH_PROPERTY_MAPPING as unknown as Record<string, string>;
    default:
      return null;
  }
}

/**
 * Recursively flattens the scopeTrees hierarchy into a flat array of all documents
 * including all supporting documents (annotations, tenets, scenarios, etc.)
 */
function flattenDocuments(docs: ExportAtlasTreeDocument[]): ExportAtlasTreeDocument[] {
  const result: ExportAtlasTreeDocument[] = [];

  function traverse(doc: ExportAtlasTreeDocument) {
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
 * Truncates text to specified length, trying to include the matching query.
 * If a match is found, centers the preview around it. Otherwise, shows the beginning.
 */
function truncateText(text: string, maxLength: number, query?: string): string {
  // Convert Markdown links [text](url) to plain text before truncating
  const plainText = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  if (plainText.length <= maxLength) return plainText;

  // If no query or query not found, truncate from start
  if (!query || !query.trim()) {
    return plainText.slice(0, maxLength).trim() + '...';
  }

  const trimmedQuery = query.trim().toLowerCase();
  const lowerText = plainText.toLowerCase();
  const matchIndex = lowerText.indexOf(trimmedQuery);

  // If query not found in text, truncate from start
  if (matchIndex === -1) {
    return plainText.slice(0, maxLength).trim() + '...';
  }

  // Calculate how much text to show before and after the match
  const matchLength = trimmedQuery.length;
  const halfLength = Math.floor((maxLength - matchLength) / 2);

  // Determine start position (try to center the match)
  let start = Math.max(0, matchIndex - halfLength);
  let end = start + maxLength;

  // Adjust if we're at the end of the text
  if (end > plainText.length) {
    end = plainText.length;
    start = Math.max(0, end - maxLength);
  }

  // Build the result with ellipses as needed
  const prefix = start > 0 ? '...' : '';
  const suffix = end < plainText.length ? '...' : '';
  const excerpt = plainText.slice(start, end).trim();

  return prefix + excerpt + suffix;
}

/**
 * Highlights matching text in a string by wrapping matches in a span with bg-yellow-200
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const trimmedQuery = query.trim();
  const regex = new RegExp(`(${trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
      return (
        <mark key={index} className="bg-yellow-200 font-medium">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export default function SearchModal({ scopeTrees, uuidMappings, isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');

  // Flatten all documents once on mount
  const allDocuments = useMemo(() => flattenDocuments(scopeTrees), [scopeTrees]);

  // Filter documents based on search query and return results with matched field info
  const filteredDocuments = useMemo((): SearchResult[] => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return [];

    const results: SearchResult[] = [];

    for (const doc of allDocuments) {
      const docNo = (doc.doc_no || '').toLowerCase();
      const name = (doc.name || '').toLowerCase();
      const content = (doc.content || '').toLowerCase();

      // Check standard fields first (prioritize in order)
      if (docNo.includes(trimmedQuery)) {
        results.push({ doc, matchedField: 'doc_no' });
        continue;
      }
      if (name.includes(trimmedQuery)) {
        results.push({ doc, matchedField: 'name' });
        continue;
      }
      if (content.includes(trimmedQuery)) {
        results.push({ doc, matchedField: 'content' });
        continue;
      }

      // Check extra fields if this document type has them
      const extraFieldKeys = extraFieldsByDocumentType[doc.type];
      if (extraFieldKeys && extraFieldKeys.length > 0) {
        const propertyMapping = getPropertyMappingForDocumentType(doc.type);

        // Check each extra field value
        for (const fieldKey of extraFieldKeys) {
          const fieldValue = (doc as unknown as Record<string, unknown>)[fieldKey];
          if (typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(trimmedQuery)) {
            const label = propertyMapping?.[fieldKey] || fieldKey;
            results.push({
              doc,
              matchedField: fieldKey,
              matchedFieldLabel: label,
              matchedFieldValue: fieldValue,
            });
            break; // Only show first matching extra field
          }
        }
      }
    }

    // Limit to top 50 results for performance
    return results.slice(0, 50);
  }, [query, allDocuments]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
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

  const handleResultClick = (result: SearchResult) => {
    const docNo = result.doc.doc_no;
    if (!docNo) {
      console.warn('Cannot navigate to document without doc_no:', result.doc);
      return;
    }

    // Reset query and close modal
    setQuery('');
    onClose();

    // Trigger expansion and navigation to the target document
    // The custom event will handle both expansion and hash update
    dispatchExpandScopeEvent({
      targetDocID: docNo,
    });
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
              {filteredDocuments.map((result, idx) => {
                const { doc } = result;
                const notionId = doc.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(doc.uuid) : null;
                const key = notionId || doc.doc_no || `result-${idx}`;

                // Determine what content to show in preview
                let previewContent = '';
                let previewLabel = '';

                if (result.matchedField === 'content' && doc.content) {
                  previewContent = doc.content;
                } else if (result.matchedFieldValue && result.matchedFieldLabel) {
                  // Show the matched extra field
                  previewContent = result.matchedFieldValue;
                  previewLabel = result.matchedFieldLabel;
                } else if (doc.content) {
                  // Fallback to content if available
                  previewContent = doc.content;
                }

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleResultClick(result)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleResultClick(result);
                      }
                    }}
                    className="cursor-pointer rounded-lg bg-slate-100 p-3 transition-all hover:bg-blue-100 focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none"
                    aria-label={`Navigate to ${doc.name || 'Untitled'} (${doc.doc_no || 'No document number'})`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {doc.doc_no && (
                        <span className="inline-block rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                          {highlightText(doc.doc_no, query)}
                        </span>
                      )}
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${typeColorMap[doc.type]}`}
                      >
                        {doc.type}
                      </span>
                    </div>
                    <div className="mb-1 font-semibold text-slate-900">
                      {highlightText(doc.name || '<Untitled>', query)}
                    </div>
                    {previewContent && (
                      <div className="text-sm text-slate-600">
                        {previewLabel && <span className="font-medium text-slate-700">{previewLabel}: </span>}
                        {highlightText(truncateText(previewContent, 150, query), query)}
                      </div>
                    )}
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
