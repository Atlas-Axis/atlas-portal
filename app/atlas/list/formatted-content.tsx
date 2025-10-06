'use client';

import styles from './formatted-content.module.css';

export function FormattedContent({ html }: { html: string }) {
  // TODO: sanitize HTML to prevent XSS
  return <div className={styles.formattedContent} dangerouslySetInnerHTML={{ __html: html }} />;
}
