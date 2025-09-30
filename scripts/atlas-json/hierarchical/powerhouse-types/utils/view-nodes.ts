import type { NotionDataItem, SectionNotionDataItem } from "../types/index.js";
import { isSectionDocType } from "./processing.js";

/**
 * Sorts an array of items by their document number
 * Handles document numbers in the format "X.Y.Z" by comparing the last number
 * Falls back to string comparison if no numbers are found
 */
export function makeSortedByDocNo<
  T extends Record<string, any> & { docNo: string },
>(arr: T[]) {
  return arr.toSorted(sortByDocNo);
}

/**
 * Sorts an array of items by either their number or document number
 * Items with numbers are sorted first, followed by items sorted by document number
 * Used to allow AA to apply their own sorting logic to items
 */
export function makeSortedByNumberOrDocNo<
  T extends Record<string, any> & {
    docNo: string | null | undefined;
    number?: number | null | undefined;
  },
>(arr: T[]) {
  const hasNumber = arr.filter(
    (item) => item.number !== null && item.number !== undefined,
  );
  const doesNotHaveNumber = arr.filter(
    (item) => item.number === null || item.number === undefined,
  );
  return [
    ...makeSortedByNumber(
      hasNumber as (Record<string, any> & { number: number })[],
    ),
    ...makeSortedByDocNo(
      doesNotHaveNumber as Record<string, any> & { docNo: string }[],
    ),
  ] as T[];
}

/**
 * Sorts an array of items by their number field
 * Used for ordering sections that have explicit numbering
 */
function makeSortedByNumber(arr: Record<string, any> & { number: number }[]) {
  return arr.toSorted(sortByNumber);
}

/**
 * Comparison function for sorting by number field
 * Returns negative if a < b, positive if a > b, zero if equal
 */
function sortByNumber(
  a: Record<string, any> & {
    number: number;
  },
  b: Record<string, any> & {
    number: number;
  },
) {
  return a.number - b.number;
}

/**
 * Comparison function for sorting by document number
 * Extracts the last number from the document number string for comparison
 * Falls back to string comparison if no numbers are found
 */
function sortByDocNo(
  a: Record<string, any> & { docNo: string | null | undefined },
  b: Record<string, any> & { docNo: string | null | undefined },
) {
  const docNoA = a.docNo;
  const docNoB = b.docNo;
  if (!docNoA || !docNoB) {
    throw new Error("No doc no strings found");
  }
  const numbersA = docNoA.match(/\d+/g);
  const numbersB = docNoB.match(/\d+/g);
  if (!numbersA || !numbersB) {
    return docNoA.localeCompare(docNoB);
  }
  const lastNumberA = Number(numbersA.at(-1));
  const lastNumberB = Number(numbersB.at(-1));

  return lastNumberA - lastNumberB;
}

/**
 * Extracts the first element from a string split by " - "
 * Used for processing document titles and identifiers
 */
export function getFirstElement(s: string) {
  return s.split(" - ").at(0);
}

/**
 * Extracts the last element from a string split by " - "
 * Used for processing document titles and identifiers
 */
export function getLastElement(s: string) {
  return s.split(" - ").at(-1);
}

/**
 * Type guard to check if an item is a section item
 */
export function isSectionItem(item: NotionDataItem): item is SectionNotionDataItem {
  return isSectionDocType(item.type);
}
