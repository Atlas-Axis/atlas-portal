'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './details-accordion.module.css';

interface DetailsAccordionItemProps {
  /** Unique identifier for the accordion item */
  id: string;
  /** Whether the accordion is expanded */
  isExpanded: boolean;
  /** Callback when expansion state should change */
  onToggle: () => void;
  /** Content to display in the summary/header */
  title: React.ReactNode;
  /** Content to display when expanded */
  children: React.ReactNode;
  /** Additional class name for the details element */
  className?: string;
  /** Additional class name for the summary element */
  summaryClassName?: string;
  /** Additional class name for the content wrapper */
  contentClassName?: string;
  /** Whether this item is highlighted (e.g., from URL hash) */
  isHighlighted?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Data attribute for document ID (used for scrolling) */
  dataDocId?: string;
  /** Whether this is a root-level accordion item (Scopes) - uses larger styling */
  isRoot?: boolean;
}

/**
 * A custom accordion item using native <details>/<summary> elements.
 * This enables text selection in Safari, which blocks text selection inside <button> elements.
 *
 * Key features:
 * - Text selection works in all browsers including Safari
 * - Prevents toggle when user is selecting text (via getSelection() check)
 * - Controlled expansion via isExpanded prop
 * - Syncs React state with native details open attribute
 * - Lazy rendering: children are only rendered when expanded (performance optimization)
 */
export function DetailsAccordionItem({
  id,
  isExpanded,
  onToggle,
  title,
  children,
  className = '',
  summaryClassName = '',
  contentClassName = '',
  isHighlighted = false,
  ariaLabel,
  dataDocId,
  isRoot = false,
}: DetailsAccordionItemProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Sync external state to DOM (for programmatic expansion from hash navigation, etc.)
  useEffect(() => {
    if (detailsRef.current && detailsRef.current.open !== isExpanded) {
      detailsRef.current.open = isExpanded;
    }
  }, [isExpanded]);

  /**
   * Handle the native toggle event.
   * This fires after the browser has already toggled the open state.
   * We sync the DOM state back to React, but prevent toggle if user was selecting text.
   */
  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const details = e.currentTarget;
    const newOpenState = details.open;

    // Check if user has selected text - if so, revert the toggle
    // This allows click-drag text selection without toggling
    const selection = window.getSelection();
    const hasTextSelection = selection && selection.toString().trim().length > 0;

    if (hasTextSelection) {
      // User was selecting text, revert the toggle
      details.open = isExpanded;
      return;
    }

    // Sync to React state if the state is actually changing
    if (newOpenState !== isExpanded) {
      onToggle();
    }
  };

  /**
   * Handle click on the summary element.
   * We need to check for text selection here too because the toggle event
   * fires before we can reliably check selection in some browsers.
   */
  const handleSummaryClick = (e: React.MouseEvent<HTMLElement>) => {
    // Check if user has selected text
    const selection = window.getSelection();
    const hasTextSelection = selection && selection.toString().trim().length > 0;

    if (hasTextSelection) {
      // Prevent the default toggle behavior when text is selected
      e.preventDefault();
    }
  };

  const detailsClassName = `${styles.details} ${isRoot ? styles.rootDetails : ''} ${className}`;
  const summaryClassNameFinal = `${styles.summary} ${isRoot ? styles.rootSummary : ''} ${isHighlighted ? styles.highlighted : ''} ${summaryClassName}`;

  return (
    <details
      ref={detailsRef}
      id={id}
      className={detailsClassName}
      open={isExpanded}
      onToggle={handleToggle}
      data-doc-id={dataDocId}
    >
      <summary className={summaryClassNameFinal} onClick={handleSummaryClick} aria-label={ariaLabel}>
        <ChevronRight
          className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
          size={isRoot ? 20 : 16}
          aria-hidden="true"
        />
        <div className={styles.titleWrapper}>{title}</div>
      </summary>
      {/* Lazy rendering: only render children when expanded to reduce DOM size */}
      {isExpanded && <div className={`${styles.content} ${contentClassName}`}>{children}</div>}
    </details>
  );
}

interface DetailsAccordionProps {
  /** Child accordion items */
  children: React.ReactNode;
  /** Additional class name for the container */
  className?: string;
}

/**
 * Container for multiple DetailsAccordionItem components.
 * This is a simple wrapper that applies consistent styling.
 */
export function DetailsAccordion({ children, className = '' }: DetailsAccordionProps) {
  return <div className={`${styles.accordion} ${className}`}>{children}</div>;
}
