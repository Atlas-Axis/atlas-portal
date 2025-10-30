'use client';

import React from 'react';
import { StandardizedAtlasDocument, extraFieldsByDocumentType } from '@/app/server/atlas/json-export/types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';

type ExtraFieldValue = string | number | boolean | string[] | null | undefined;

/**
 * Get the appropriate label mapping for a document type's extra fields.
 */
function getLabelMapping(documentType: StandardizedAtlasDocument['type']): Record<string, string> {
  switch (documentType) {
    case 'Type Specification':
      return TYPE_SPECIFICATION_PROPERTY_MAPPING as Record<string, string>;
    case 'Scenario':
      return SCENARIO_PROPERTY_MAPPING as Record<string, string>;
    case 'Scenario Variation':
      return SCENARIO_VARIATION_PROPERTY_MAPPING as Record<string, string>;
    case 'Needed Research':
      return NEEDED_RESEARCH_PROPERTY_MAPPING as Record<string, string>;
    default:
      return {};
  }
}

/**
 * Renders extra fields for document types that have them (Type Specification, Scenario, Scenario Variation, Needed Research).
 * Displays each field as a label-value pair.
 */
export function StandardizedExtraData({
  node,
  className,
}: {
  node: StandardizedAtlasDocument;
  className?: string;
}): React.ReactElement | null {
  const extraKeys = extraFieldsByDocumentType[node.type] || [];
  if (extraKeys.length === 0) {
    return null;
  }

  const labelMapping = getLabelMapping(node.type);
  const record = node as unknown as Record<string, ExtraFieldValue>;

  const rows = extraKeys.map((key) => ({ key, label: labelMapping[key] || key, value: record[key] }));

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mt-2 text-sm text-slate-600">
        {rows.map(({ key, label, value }) => (
          <div key={key} className="mb-1">
            <p className="font-semibold text-slate-700">{label}:</p>{' '}
            <p>{Array.isArray(value) ? value.join(', ') : String(value || '-')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
