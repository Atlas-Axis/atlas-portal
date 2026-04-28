export type AtlasDatabaseName =
  | 'Scopes'
  | 'Articles'
  | 'Sections & Primary Docs'
  | 'Annotations'
  | 'Tenets'
  | 'Scenarios'
  | 'Scenario Variations'
  | 'Active Data'
  | 'Agent Scope Database'
  | 'Needed Research';

export type AtlasDocumentType =
  | 'Section'
  | 'Core'
  | 'Type Specification'
  | 'Active Data Controller'
  | 'Action Tenet'
  | 'Active Data'
  | 'Annotation'
  | 'Scope'
  | 'Article'
  | 'Scenario'
  | 'Scenario Variation'
  | 'Needed Research';

export type AtlasDatabaseID = string;

export type MasterStatus = 'Approved' | 'Provisional' | 'Placeholder' | 'Deferred' | 'Archived';
