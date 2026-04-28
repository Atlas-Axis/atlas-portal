import {
  type ExportAtlasTreeDocument,
  allowedChildCollectionNamesPerDatabase,
  childCollectionNameToDatabaseName,
  childCollectionNames,
  extraFieldsByDocumentType,
} from '@/app/server/atlas/export/types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { ATLAS_DOCUMENT_TYPES, AtlasDatabaseName, AtlasDocumentType } from '../constants';

export type ValidationErrorKind =
  | 'JSON_PARSE_ERROR'
  | 'ROOT_NOT_ARRAY'
  | 'NODE_MISSING_TYPE'
  | 'NODE_INVALID_TYPE'
  | 'NODE_INVALID_DATABASE' // TODO
  | 'NODE_UNEXPECTED_FIELD'
  | 'NODE_MISSING_REQUIRED_FIELD'
  | 'FIELD_TYPE_MISMATCH'
  | 'CHILD_COLLECTION_NOT_ALLOWED'
  | 'CHILD_COLLECTION_NOT_ARRAY'
  | 'CHILD_ITEM_NOT_OBJECT'
  | 'CHILD_NODE_TYPE_MISMATCH';

export interface ValidationError {
  kind: ValidationErrorKind;
  nodeId: string;
  path: string; // JSON path like $.0.sections.2
  message: string; // human-readable description and simple fix guidance
  actionSuggestion: string; // concise imperative suggestion (e.g., Remove field "X")
  node: Partial<ExportAtlasTreeDocument>; // shallow snapshot; child collections emptied
}

// Base fields required on every ExportAtlasTreeDocument
// `last_modified` is optional in inputs
const baseRequiredFields = ['type', 'doc_no', 'name', 'uuid', 'content'] as const;

/**
 * Returns true when value is a non-null object (and not an array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function asAllowedDatabase(databaseValue: unknown): AtlasDatabaseName | null {
  if (typeof databaseValue !== 'string') return null;
  return (Object.keys(allowedChildCollectionNamesPerDatabase) as AtlasDatabaseName[]).includes(
    databaseValue as AtlasDatabaseName,
  )
    ? (databaseValue as AtlasDatabaseName)
    : null;
}

function asAllowedDocumentType(typeValue: unknown): AtlasDocumentType | null {
  if (typeof typeValue !== 'string') return null;
  const allowedTypes: AtlasDocumentType[] = ATLAS_DOCUMENT_TYPES;
  return allowedTypes.includes(typeValue as AtlasDocumentType) ? (typeValue as AtlasDocumentType) : null;
}

function validDocumentTypesList(): string {
  return ATLAS_DOCUMENT_TYPES.join(', ');
}

function makeNodeSnapshot(node: Record<string, unknown>): Partial<ExportAtlasTreeDocument> {
  const snapshot: Record<string, unknown> = { ...node };
  // Ensure known child collections are arrays but empty
  for (const key of childCollectionNames) {
    snapshot[key] = Array.isArray(node[key]) ? [] : [];
  }
  return snapshot as Partial<ExportAtlasTreeDocument>;
}

/**
 * Best-effort identifier for a node. Prefers `uuid`, then `doc_no`, else falls back to the JSON path.
 */
function getNodeId(node: Record<string, unknown>, path: string): string {
  const uuid = typeof node.uuid === 'string' || node.uuid === null ? (node.uuid as string | null) : null;
  const docNo = typeof node.doc_no === 'string' ? (node.doc_no as string) : null;
  if (uuid && uuid.length > 0) return uuid;
  if (docNo && docNo.length > 0) return docNo;
  // fall back to path to help pinpoint
  return path;
}

/**
 * Helper to push a structured error to the shared errors array.
 */
function addError(
  errors: ValidationError[],
  kind: ValidationErrorKind,
  node: Record<string, unknown> | null,
  path: string,
  message: string,
  actionSuggestion: string,
): void {
  errors.push({
    kind,
    nodeId: node ? getNodeId(node, path) : '$',
    path,
    message,
    actionSuggestion,
    node: node ? makeNodeSnapshot(node) : ({} as Partial<ExportAtlasTreeDocument>),
  });
}

/**
 * Validates a single node and recursively validates all of its children.
 * Accumulates all issues in `errors` without short-circuiting.
 */
function validateNode(
  node: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  currentDatabase: AtlasDatabaseName | null,
): void {
  // type present and valid
  if (!('type' in node)) {
    addError(
      errors,
      'NODE_MISSING_TYPE',
      node,
      path,
      `Missing field "type". Set to a valid Atlas document type. Valid document types: ${validDocumentTypesList()}.`,
      'Add a valid "type" to this node (see valid document types above).',
    );
    return; // Without a type we cannot derive allowed fields; stop node-level checks but do not stop entire validation
  }

  const documentType = asAllowedDocumentType(node.type);
  if (!documentType) {
    addError(
      errors,
      'NODE_INVALID_TYPE',
      node,
      path,
      `Invalid "type" value. Expected one of the Atlas document types; found ${String(node.type)}. Valid document types: ${validDocumentTypesList()}.`,
      'Set "type" to one of the valid Atlas document types listed.',
    );
    return;
  }

  // base required fields
  for (const field of baseRequiredFields) {
    if (!(field in node)) {
      addError(
        errors,
        'NODE_MISSING_REQUIRED_FIELD',
        node,
        path,
        `Missing required field "${field}". Add this field with the correct type.`,
        `Add required field "${field}" with a valid value.`,
      );
    }
  }

  // base type checks (best-effort)
  if ('doc_no' in node && typeof node.doc_no !== 'string') {
    addError(
      errors,
      'FIELD_TYPE_MISMATCH',
      node,
      path,
      'Field "doc_no" must be a string.',
      'Set "doc_no" to a string.',
    );
  }
  if ('name' in node && typeof node.name !== 'string') {
    addError(errors, 'FIELD_TYPE_MISMATCH', node, path, 'Field "name" must be a string.', 'Set "name" to a string.');
  }
  if ('uuid' in node && !(typeof node.uuid === 'string' || node.uuid === null)) {
    addError(
      errors,
      'FIELD_TYPE_MISMATCH',
      node,
      path,
      'Field "uuid" must be a string or null.',
      'Set "uuid" to a string or null.',
    );
  }
  if ('last_modified' in node && typeof node.last_modified !== 'string') {
    addError(
      errors,
      'FIELD_TYPE_MISMATCH',
      node,
      path,
      'Field "last_modified" must be a string.',
      'Set "last_modified" to a string or remove it.',
    );
  }
  if ('content' in node && typeof node.content !== 'string') {
    addError(
      errors,
      'FIELD_TYPE_MISMATCH',
      node,
      path,
      'Field "content" must be a string.',
      'Set "content" to a string.',
    );
  }

  // extra field type checks for specific document types (string or null)
  const ensureStringOrNull = (fieldKey: string) => {
    if (fieldKey in node) {
      const v = (node as Record<string, unknown>)[fieldKey];
      if (!(typeof v === 'string' || v === null)) {
        addError(
          errors,
          'FIELD_TYPE_MISMATCH',
          node,
          `${path}.${fieldKey}`,
          `Field "${fieldKey}" must be a string or null.`,
          `Set "${fieldKey}" to a string or null (or remove it).`,
        );
      }
    }
  };

  switch (documentType) {
    case 'Scenario': {
      for (const k of Object.keys(SCENARIO_PROPERTY_MAPPING)) ensureStringOrNull(k);
      break;
    }
    case 'Scenario Variation': {
      for (const k of Object.keys(SCENARIO_VARIATION_PROPERTY_MAPPING)) ensureStringOrNull(k);
      break;
    }
    case 'Type Specification': {
      for (const k of Object.keys(TYPE_SPECIFICATION_PROPERTY_MAPPING)) ensureStringOrNull(k);
      break;
    }
    case 'Needed Research': {
      for (const k of Object.keys(NEEDED_RESEARCH_PROPERTY_MAPPING)) ensureStringOrNull(k);
      break;
    }
    default:
      break;
  }

  // allowed child collections are based on the current database, not the document type
  const allowedCollectionsForDb: Set<string> | null = currentDatabase
    ? new Set<string>(allowedChildCollectionNamesPerDatabase[currentDatabase])
    : null;
  // compute full allowed keys for unexpected-field detection: base + extra fields (by document type) + any child collection names
  const allowedKeys = new Set<string>([
    ...baseRequiredFields,
    ...(extraFieldsByDocumentType[documentType] ?? []),
    ...childCollectionNames,
  ]);

  // flag unexpected fields and disallowed child collections
  for (const key of Object.keys(node)) {
    if ((childCollectionNames as ReadonlyArray<string>).includes(key)) {
      // it's a child collection name
      if (allowedCollectionsForDb && !allowedCollectionsForDb.has(key)) {
        addError(
          errors,
          'CHILD_COLLECTION_NOT_ALLOWED',
          node,
          path,
          `Child collection "${key}" is not allowed for database "${currentDatabase}". Remove it.`,
          `Remove child collection "${key}" from this node.`,
        );
      }
      continue;
    }
    if (!allowedKeys.has(key)) {
      addError(
        errors,
        'NODE_UNEXPECTED_FIELD',
        node,
        path,
        `Unexpected field "${key}". Remove this field.`,
        `Remove unexpected field "${key}".`,
      );
    }
  }

  // validate child collections and recurse for any present child arrays
  for (const collectionName of childCollectionNames) {
    const value = (node as Record<string, unknown>)[collectionName] as unknown;
    if (value === undefined) continue; // absent is fine
    if (!Array.isArray(value)) {
      addError(
        errors,
        'CHILD_COLLECTION_NOT_ARRAY',
        node,
        `${path}.${collectionName}`,
        `Child collection "${collectionName}" must be an array.`,
        `Change "${collectionName}" to be an array.`,
      );
      continue;
    }

    const childDatabase =
      childCollectionNameToDatabaseName[collectionName as keyof typeof childCollectionNameToDatabaseName];
    value.forEach((child: unknown, idx: number) => {
      const childPath = `${path}.${collectionName}.${idx}`;
      if (!isPlainObject(child)) {
        addError(
          errors,
          'CHILD_ITEM_NOT_OBJECT',
          node,
          childPath,
          'Each child must be an object.',
          'Replace this child with an object node.',
        );
        return;
      }
      // Recurse to validate child fully, carrying database context inferred from the collection name
      validateNode(child as Record<string, unknown>, childPath, errors, childDatabase);
    });
  }
}

/**
 * Validate a JSON string representing a list of Export Atlas Tree Documents.
 *
 * Parsing and validation rules:
 * - Root must be an array. Each item must be an object (a node).
 * - Each node must have a valid `type` and required base fields.
 * - Child collections must be arrays and allowed for the node's type; their items must be objects of the expected type.
 * - Validation recurses into children. All errors are collected; no short-circuiting.
 * - Errors include a shallow node snapshot with child arrays emptied for safety and readability.
 *
 * Tests: see `scripts/atlas-export/__tests__/validate-export-atlas-tree.test.ts`.
 *
 * @param jsonString JSON string containing the Export Atlas Tree (array of root nodes)
 * @returns Object with `errors` (list of ValidationError) and `root` (parsed array on success, otherwise null)
 */
export function validateExportAtlasTree(jsonString: string): {
  errors: ValidationError[];
  root: ExportAtlasTreeDocument[] | null;
} {
  const errors: ValidationError[] = [];

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e: unknown) {
    errors.push({
      kind: 'JSON_PARSE_ERROR',
      nodeId: '$',
      path: '$',
      message: `JSON syntax error: ${
        typeof e === 'object' && e !== null && 'message' in e ? String((e as { message?: unknown }).message) : String(e)
      }. Fix the JSON and try again.`,
      actionSuggestion: 'Fix JSON syntax (commas, quotes, braces) and retry.',
      node: {} as Partial<ExportAtlasTreeDocument>,
    });
    return { errors, root: null };
  }

  if (!Array.isArray(parsed)) {
    errors.push({
      kind: 'ROOT_NOT_ARRAY',
      nodeId: '$',
      path: '$',
      message: 'Root must be an array of Atlas document objects.',
      actionSuggestion: 'Wrap root object(s) in an array (e.g., [ { ... } ]).',
      node: {} as Partial<ExportAtlasTreeDocument>,
    });
    return { errors, root: null };
  }

  // Validate each root element
  parsed.forEach((item, idx) => {
    const path = `$.${idx}`;
    if (!isPlainObject(item)) {
      addError(
        errors,
        'CHILD_ITEM_NOT_OBJECT',
        null,
        path,
        'Each root item must be an object.',
        'Replace with an object.',
      );
      return;
    }
    // Root-level items have no inherent database context; child collections establish database groupings.
    validateNode(item, path, errors, null);
  });

  return { errors, root: parsed as ExportAtlasTreeDocument[] };
}

export default validateExportAtlasTree;
