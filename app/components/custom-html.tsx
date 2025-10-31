'use client';

import 'katex/dist/katex.min.css';
import { processKaTeXInHTML } from '@/app/shared/utils/process-katex';
import styles from './custom-html.module.css';

export function CustomHTML({ html }: { html: string }) {
  // Process TeX math expressions before rendering using KaTeX
  // Supports inline math (`$...$`) and display math (`$$...$$`) delimiters
  const processedHtml = processKaTeXInHTML(html);

  // TODO: sanitize HTML to prevent XSS
  return (
    <div className={`${styles.formattedContent} custom-html`} dangerouslySetInnerHTML={{ __html: processedHtml }} />
  );
}
