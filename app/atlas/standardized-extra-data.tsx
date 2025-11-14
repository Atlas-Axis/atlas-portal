'use client';

import React from 'react';
import { CustomHTML } from '@/app/components/custom-html';
import { ExportAtlasTreeDocument, extraFieldsByDocumentType } from '@/app/server/atlas/export/types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';

type ExtraFieldValue = string | number | boolean | string[] | null | undefined;

/**
 * Get the appropriate label mapping for a document type's extra fields.
 */
function getLabelMapping(documentType: ExportAtlasTreeDocument['type']): Record<string, string> {
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
 * Displays each field as a label-value pair with markdown formatting support.
 */
export function StandardizedExtraData({
  node,
  className,
  uuidToDocNoMap,
}: {
  node: ExportAtlasTreeDocument;
  className?: string;
  uuidToDocNoMap: Map<string, string>;
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
      <div className="mt-2 flex flex-col gap-y-3 text-sm text-slate-600">
        {rows.map(({ key, label, value }) => {
          // Format the value based on its type
          let formattedValue: React.ReactNode;

          if (value === null || value === undefined) {
            formattedValue = '-';
          } else if (Array.isArray(value)) {
            // For arrays, join with comma and format as markdown
            const joinedValue = value.join(', ');
            const html = markdownToHTML(joinedValue, uuidToDocNoMap);
            formattedValue = <CustomHTML html={html} />;
          } else if (typeof value === 'string') {
            // For strings, format as markdown
            const html = markdownToHTML(value, uuidToDocNoMap);
            formattedValue = <CustomHTML html={html} />;
          } else {
            // For numbers and booleans, convert to string
            formattedValue = String(value);
          }

          return (
            <div key={key}>
              <p className="mb-0.5 font-semibold text-slate-700">{label}:</p>
              <div>{formattedValue}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
