#!/usr/bin/env npx tsx
/**
 * Sky Atlas HTML Analytics Script
 *
 * This script analyzes the Sky Atlas HTML file and provides comprehensive analytics
 * about the document structure and content distribution across all sections.
 *
 * USAGE:
 *   npx tsx scripts/atlas-github-html-analytics.ts
 *
 * WHAT IT DOES:
 * - Fetches the Sky Atlas HTML file from GitHub repository
 * - Analyzes 11 sections: scopes, articles, sections, type-specifications, annotations,
 *   tenets, scenarios, scenario-variations, needed-research, active-data, agent-scope
 * - Counts documents in each section by parsing HTML table structures
 * - Provides visual analytics including distribution charts and rankings
 * - Shows sample documents from each section
 *
 * OUTPUT:
 * - Overall summary (total sections, documents, content status)
 * - Detailed section breakdown with document counts and samples
 * - Document distribution chart with percentages
 * - Top 5 largest sections ranking
 *
 * REQUIREMENTS:
 * - Node.js with tsx support
 * - jsdom dependency (automatically installed)
 * - Internet connection to fetch HTML from GitHub
 */
import { JSDOM } from 'jsdom';
import { ATLAS_GITHUB_HTML_URL } from '@/app/server/services/atlas/constants';

interface SectionAnalytics {
  sectionId: string;
  sectionName: string;
  documentCount: number;
  hasContent: boolean;
  tableHeaders: string[];
  sampleDocuments: Array<{
    docNo: string;
    name: string;
    type: string;
  }>;
}

interface OverallAnalytics {
  totalSections: number;
  totalDocuments: number;
  sectionsWithContent: number;
  sectionsWithoutContent: number;
  sectionBreakdown: SectionAnalytics[];
}

async function analyzeSkAtlas(): Promise<OverallAnalytics> {
  try {
    console.log(`Fetching Sky Atlas HTML from: ${ATLAS_GITHUB_HTML_URL}`);
    const response = await fetch(ATLAS_GITHUB_HTML_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
    }

    const htmlContent = await response.text();
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    const sectionIds = [
      'scopes',
      'articles',
      'sections',
      'type-specifications',
      'annotations',
      'tenets',
      'scenarios',
      'scenario-variations',
      'needed-research',
      'active-data',
      'agent-scope',
    ];

    const sectionBreakdown: SectionAnalytics[] = [];
    let totalDocuments = 0;
    let sectionsWithContent = 0;
    let sectionsWithoutContent = 0;

    for (const sectionId of sectionIds) {
      const sectionDiv = document.getElementById(sectionId);

      if (!sectionDiv) {
        console.warn(`Section with ID '${sectionId}' not found`);
        continue;
      }

      const h1Element = sectionDiv.querySelector('h1');
      const sectionName = h1Element?.textContent?.trim() || sectionId;

      const table = sectionDiv.querySelector('table');

      // Get table headers
      const headerRow = table?.querySelector('tr');
      const headers = Array.from(headerRow?.querySelectorAll('th') || []).map(
        (th: Element) => th.textContent?.trim() || '',
      );

      // Count document rows (excluding header)
      // Get all table rows, excluding the header row
      const allRows = Array.from(table?.querySelectorAll('tr') || []);

      // Filter out header rows (rows that contain th elements)
      const documentRows = allRows.filter((row) => {
        const hasThElements = row.querySelectorAll('th').length > 0;
        const hasTdElements = row.querySelectorAll('td').length > 0;
        return !hasThElements && hasTdElements; // Only data rows (td elements, no th elements)
      });

      const documentCount = documentRows.length;

      // Get sample documents (first 3)
      const sampleDocuments = documentRows.slice(0, 3).map((row: Element) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          docNo: (cells[0] as Element)?.textContent?.trim() || '',
          name: (cells[1] as Element)?.textContent?.trim() || '',
          type: (cells[2] as Element)?.textContent?.trim() || '',
        };
      });

      const hasContent = documentCount > 0;
      if (hasContent) {
        sectionsWithContent++;
      } else {
        sectionsWithoutContent++;
      }

      totalDocuments += documentCount;

      sectionBreakdown.push({
        sectionId,
        sectionName,
        documentCount,
        hasContent,
        tableHeaders: headers,
        sampleDocuments,
      });
    }

    return {
      totalSections: sectionIds.length,
      totalDocuments,
      sectionsWithContent,
      sectionsWithoutContent,
      sectionBreakdown,
    };
  } catch (error) {
    console.error('Error reading or parsing HTML file:', error);
    throw error;
  }
}

function printAnalytics(analytics: OverallAnalytics): void {
  console.log('='.repeat(80));
  console.log('SKY ATLAS HTML ANALYTICS');
  console.log('='.repeat(80));
  console.log();

  // Overall summary
  console.log('📊 OVERALL SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total Sections: ${analytics.totalSections}`);
  console.log(`Total Documents: ${analytics.totalDocuments.toLocaleString()}`);
  console.log(`Sections with Content: ${analytics.sectionsWithContent}`);
  console.log(`Sections without Content: ${analytics.sectionsWithoutContent}`);
  console.log();

  // Section breakdown
  console.log('📋 SECTION BREAKDOWN');
  console.log('-'.repeat(40));

  // Sort by document count (descending)
  const sortedSections = [...analytics.sectionBreakdown].sort((a, b) => b.documentCount - a.documentCount);

  for (const section of sortedSections) {
    const statusIcon = section.hasContent ? '✅' : '❌';
    console.log(`${statusIcon} ${section.sectionName}`);
    console.log(`    ID: #${section.sectionId}`);
    console.log(`    Documents: ${section.documentCount.toLocaleString()}`);
    console.log(`    Headers: [${section.tableHeaders.join(', ')}]`);

    if (section.sampleDocuments.length > 0) {
      console.log(`    Sample Documents:`);
      for (const doc of section.sampleDocuments) {
        console.log(`      • ${doc.docNo} - ${doc.name} (${doc.type})`);
      }
    }
    console.log();
  }

  // Document distribution
  console.log('📈 DOCUMENT DISTRIBUTION');
  console.log('-'.repeat(40));

  for (const section of sortedSections) {
    if (section.documentCount > 0) {
      const percentage = ((section.documentCount / analytics.totalDocuments) * 100).toFixed(1);
      const barLength = Math.floor((section.documentCount / sortedSections[0].documentCount) * 20);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      console.log(
        `${section.sectionName.padEnd(25)} ${bar} ${section.documentCount.toString().padStart(6)} (${percentage}%)`,
      );
    }
  }
  console.log();

  console.log('='.repeat(80));
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      console.log('Analyzing Sky Atlas HTML file...\n');
      const analytics = await analyzeSkAtlas();
      printAnalytics(analytics);
    } catch (error) {
      console.error('Failed to analyze Sky Atlas:', error);
      process.exit(1);
    }
  })();
}

export { analyzeSkAtlas, printAnalytics };
export type { SectionAnalytics, OverallAnalytics };
