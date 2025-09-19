'use client';

import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { isTypeSpecificationAtlasDocument } from '../server/services/atlas/detect-type-specification-atlas-document';
import { TypeSpecificationExtraFields } from '../server/services/atlas/notion-database-properties-and-relationships';

export default function PageExtraData({ page, className }: { page: NotionDatabasePage; className?: string }) {
  if (isTypeSpecificationAtlasDocument(page.atlas_database_name, page.atlas_document_type, page.notion_page_id)) {
    const extraFields = getTypeSpecificationExtraFields(page);
    return (
      <div className={`${className} my-2 leading-relaxed`}>
        <dl>
          <dt>Doc Identifier Rules</dt>
          <dd>{extraFields.type_specification_doc_identifier_rules}</dd>
          <dt>Additional Logic</dt>
          <dd>{extraFields.type_specification_additional_logic}</dd>
          <dt>Type Category</dt>
          <dd>{extraFields.type_specification_type_category}</dd>
          <dt>Type Name</dt>
          <dd>{extraFields.type_specification_type_name}</dd>
          <dt>Type Overview</dt>
          <dd>{extraFields.type_specification_type_overview}</dd>
        </dl>
      </div>
    );
  }

  return null;
}

// Extract extra fields for "Type Specification" Atlas documents
function getTypeSpecificationExtraFields(page: NotionDatabasePage): TypeSpecificationExtraFields {
  // Extract `extra_fields` from Supabase page
  const supabaseExtraFields = (page.extra_fields as unknown as TypeSpecificationExtraFields) || {};
  if (!isTypeSpecificationAtlasDocument(page.atlas_database_name, page.atlas_document_type, page.notion_page_id)) {
    throw new Error('Not a Type Specification Atlas document');
  }

  return {
    type_specification_doc_identifier_rules: supabaseExtraFields?.type_specification_doc_identifier_rules || null,
    type_specification_additional_logic: supabaseExtraFields?.type_specification_additional_logic || null,
    type_specification_type_category: supabaseExtraFields?.type_specification_type_category || null,
    type_specification_type_name: supabaseExtraFields?.type_specification_type_name || null,
    type_specification_type_overview: supabaseExtraFields?.type_specification_type_overview || null,
  };
}
