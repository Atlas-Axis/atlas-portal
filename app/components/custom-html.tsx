'use client';

import styles from './custom-html.module.css';

export function CustomHTML({ html }: { html: string }) {
  // TODO: sanitize HTML to prevent XSS
  return <div className={styles.formattedContent} dangerouslySetInnerHTML={{ __html: html }} />;
}
