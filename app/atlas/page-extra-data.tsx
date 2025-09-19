'use client';

import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { isTypeSpecificationAtlasDocument } from '../server/services/atlas/detect-type-specification-atlas-document';

export default function PageExtraData({ page }: { page: NotionDatabasePage }) {
  if (isTypeSpecificationAtlasDocument(page.atlas_database_name, page.notion_page_id)) {
    // TODO
  }

  return null;
}
