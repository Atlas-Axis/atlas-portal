import { Json } from '@/app/server/services/supabase/database.types';

/**
 * Deep equality comparison for JSON values.
 * Handles nested objects, arrays, primitives, null, and undefined values.
 *
 * This is used to detect changes in rich text JSON structures from Notion,
 * including mention page IDs, formatting annotations, and other metadata
 * that plain text comparison would miss.
 *
 * @param json1 - First JSON value to compare (can be undefined)
 * @param json2 - Second JSON value to compare (can be undefined)
 * @returns true if values are deeply equal, false otherwise
 */
export function areJsonValuesEqual(json1: Json | undefined, json2: Json | undefined): boolean {
  // Handle null/undefined cases
  if (json1 === null && json2 === null) return true;
  if (json1 === null || json2 === null) return false;
  if (json1 === undefined && json2 === undefined) return true;
  if (json1 === undefined || json2 === undefined) return false;

  // Handle primitive types
  const type1 = typeof json1;
  const type2 = typeof json2;

  // If types are different, return false
  if (type1 !== type2) return false;

  // Handle primitive types
  if (type1 === 'string' || type1 === 'number' || type1 === 'boolean') {
    return json1 === json2;
  }

  // Handle arrays
  if (Array.isArray(json1) && Array.isArray(json2)) {
    if (json1.length !== json2.length) return false;

    for (let i = 0; i < json1.length; i++) {
      if (!areJsonValuesEqual(json1[i], json2[i])) {
        return false;
      }
    }

    return true;
  }

  // One is array, other is not
  if (Array.isArray(json1) || Array.isArray(json2)) {
    return false;
  }

  // Handle objects
  if (type1 === 'object' && type2 === 'object') {
    const obj1 = json1 as { [key: string]: Json | undefined };
    const obj2 = json2 as { [key: string]: Json | undefined };

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    // Use Set for O(1) lookup instead of O(n) array.includes()
    const keys2Set = new Set(keys2);

    // Check all keys in obj1 exist in obj2 with equal values
    for (const key of keys1) {
      if (!keys2Set.has(key)) return false;
      if (!areJsonValuesEqual(obj1[key] ?? null, obj2[key] ?? null)) {
        return false;
      }
    }

    return true;
  }

  // Fallback for any unexpected types
  return false;
}
