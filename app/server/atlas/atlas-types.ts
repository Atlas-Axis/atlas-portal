import { Database } from '@/app/server/services/supabase/database.types';

export type AtlasDatabaseName = Exclude<
  Database['public']['Enums']['atlas_database_name_enum'],
  'Type Specification' | 'Original Context Data'
>;

export type AtlasDocumentType = Exclude<
  Database['public']['Enums']['atlas_document_type_enum'],
  'Spell SP Controller' | 'Placeholder' | 'Category'
>;

export type AtlasDatabaseID = string;

export type MasterStatus = 'Approved' | 'Provisional' | 'Placeholder' | 'Deferred' | 'Archived';
