/**
 * Custom events used for communication between page components
 */

/**
 * Event detail for the expandScope custom event
 * Used by sidebar to request content-tree to expand a path to a document and navigate to it
 */
export interface ExpandScopeEventDetail {
  /** The root scope document ID (e.g., "A.2") that should be expanded (optional if targetDocID is provided) */
  scopeDocID: string;
  /** The target document ID (e.g., "A.2.9.3") to navigate to - will auto-expand full path (Scope → Article → Section) */
  targetDocID: string;
}

/**
 * Type-safe custom event for expanding scopes
 */
export type ExpandScopeEvent = CustomEvent<ExpandScopeEventDetail>;

/**
 * Helper function to dispatch an expandScope event
 */
export function dispatchExpandScopeEvent(detail: ExpandScopeEventDetail): void {
  const event = new CustomEvent<ExpandScopeEventDetail>('expandScope', { detail });
  window.dispatchEvent(event);
}

/**
 * Helper function to add an expandScope event listener with proper typing
 */
export function addExpandScopeListener(handler: (event: ExpandScopeEvent) => void): () => void {
  const listener = handler as EventListener;
  window.addEventListener('expandScope', listener);

  // Return cleanup function
  return () => window.removeEventListener('expandScope', listener);
}
