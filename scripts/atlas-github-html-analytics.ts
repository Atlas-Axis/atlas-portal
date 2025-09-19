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
 * - Parses the Sky Atlas HTML file located at '../app/server/services/atlas/Sky Atlas.html'
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
 * - Sky Atlas HTML file must exist in the expected location
 *
 * TODO: Load the HTML file from GitHub directly
 */
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { join } from 'path';

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

function analyzeSkAtlas(): OverallAnalytics {
  const htmlPath = join(__dirname, '../app/server/services/atlas/Sky Atlas.html');

  try {
    const htmlContent = readFileSync(htmlPath, 'utf-8');
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

  // Largest sections
  console.log('🏆 TOP 5 LARGEST SECTIONS');
  console.log('-'.repeat(40));
  const top5 = sortedSections.slice(0, 5).filter((s) => s.documentCount > 0);
  for (let i = 0; i < top5.length; i++) {
    const section = top5[i];
    const rank = i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
    console.log(`${medal} ${section.sectionName}: ${section.documentCount.toLocaleString()} documents`);
  }
  console.log();

  console.log('='.repeat(80));
}

// Main execution
if (require.main === module) {
  try {
    console.log('Analyzing Sky Atlas HTML file...\n');
    const analytics = analyzeSkAtlas();
    printAnalytics(analytics);
  } catch (error) {
    console.error('Failed to analyze Sky Atlas:', error);
    process.exit(1);
  }
}

export { analyzeSkAtlas, printAnalytics };
export type { SectionAnalytics, OverallAnalytics };
