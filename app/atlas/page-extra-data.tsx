'use client';

import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';

type ExtraFieldsMapping = Record<string, string>;

export default function PageExtraData({ page, className }: { page: NotionDatabasePage; className?: string }) {
  const { mapping, extraFieldsData } = getExtraFieldsForDocument(page);

  // If no extra fields mapping found, return null
  if (!mapping || !extraFieldsData) {
    return null;
  }

  return (
    <div className={`${className} my-2 leading-relaxed`}>
      <dl>
        {Object.entries(mapping).map(([fieldKey, label]) => {
          const value = extraFieldsData[fieldKey];
          return (
            <div key={fieldKey}>
              <dt>{label}</dt>
              <dd>{value !== null && value !== undefined ? String(value) : null}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/**
 * Returns the appropriate property mapping and extra fields data based on document type
 */
function getExtraFieldsForDocument(page: NotionDatabasePage): {
  mapping: ExtraFieldsMapping | null;
  extraFieldsData: Record<string, unknown> | null;
} {
  const supabaseExtraFields = (page.extra_fields as Record<string, unknown>) || {};

  // Type Specification documents
  if (page.atlas_document_type === 'Type Specification') {
    return {
      mapping: TYPE_SPECIFICATION_PROPERTY_MAPPING,
      extraFieldsData: supabaseExtraFields,
    };
  }

  // Scenario documents
  if (page.atlas_document_type === 'Scenario') {
    return {
      mapping: SCENARIO_PROPERTY_MAPPING,
      extraFieldsData: supabaseExtraFields,
    };
  }

  // Scenario Variation documents
  if (page.atlas_document_type === 'Scenario Variation') {
    return {
      mapping: SCENARIO_VARIATION_PROPERTY_MAPPING,
      extraFieldsData: supabaseExtraFields,
    };
  }

  // Needed Research documents
  if (page.atlas_document_type === 'Needed Research') {
    return {
      mapping: NEEDED_RESEARCH_PROPERTY_MAPPING,
      extraFieldsData: supabaseExtraFields,
    };
  }

  // No extra fields for this document type
  return {
    mapping: null,
    extraFieldsData: null,
  };
}
