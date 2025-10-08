#!/usr/bin/env npx tsx
/**
 * Atlas JSON Diff Tool
 *
 * This script compares two Atlas JSON files and reports differences between them.
 * It matches documents by name within the same category, with fallback matching
 * using content and originalDocNumber when name matching is ambiguous.
 *
 * USAGE:
 *   npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts [--verbose] [--github-file <path>] [--supabase-file <path>]
 *
 * EXAMPLES:
 *   npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts
 *   npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts --verbose
 *   npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts --github-file custom-github.json --supabase-file custom-supabase.json
 *
 * WHAT IT DOES:
 * - Loads two Atlas JSON files (default: atlas-github.json and atlas-supabase.json)
 * - Matches documents by name within each category
 * - Reports differences in document counts, missing documents, and field differences
 * - Uses content and originalDocNumber as fallback matching when name is ambiguous
 *
 * OUTPUT:
 * - Console output showing detailed differences between the two JSON files
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { ATLAS_JSON_OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_GITHUB, ATLAS_JSON_OUTPUT_FILE_SUPABASE } from './constants';
import { AtlasCategoryJson, AtlasDocumentJson } from './types';

// Resolve file paths (assumes running from repository root)
const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.join(REPO_ROOT, ATLAS_JSON_OUTPUT_DIR);

interface DocumentMatch {
  github: AtlasDocumentJson;
  supabase: AtlasDocumentJson;
  matchType: 'name' | 'content' | 'originalDocNumber';
}

interface CategoryDiff {
  category: string;
  githubCount: number;
  supabaseCount: number;
  matched: DocumentMatch[];
  githubOnly: AtlasDocumentJson[];
  supabaseOnly: AtlasDocumentJson[];
}

interface DiffResult {
  totalCategories: number;
  categoriesWithDifferences: number;
  totalDocuments: {
    github: number;
    supabase: number;
  };
  categoryDiffs: CategoryDiff[];
}

// Display help information
function displayHelp(): void {
  console.log(`
Atlas JSON Diff Tool

This script compares two Atlas JSON files and reports differences between them.
It matches documents by name within the same category, with fallback matching
using content and originalDocNumber when name matching is ambiguous.

USAGE:
  npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts [OPTIONS]

OPTIONS:
  --verbose                    Show matched documents details
  --github-file <path>         Path to GitHub JSON file (default: .debug-data/atlas-json-generated/atlas-github.json)
  --supabase-file <path>       Path to Supabase JSON file (default: .debug-data/atlas-json-generated/atlas-supabase.json)
  --help, -h                   Show this help message

EXAMPLES:
  npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts
  npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts --verbose
  npx tsx scripts/atlas-json/old/diff-atlas-jsons.ts --github-file custom-github.json --supabase-file custom-supabase.json

WHAT IT DOES:
  - Loads two Atlas JSON files (default: atlas-github.json and atlas-supabase.json)
  - Matches documents by name within each category
  - Reports missing documents (GitHub-only and Supabase-only documents)
  - Uses content and originalDocNumber as fallback matching when name is ambiguous

OUTPUT:
  - Console output showing detailed differences between the two JSON files
  - Exit code 0 if no differences found, 1 if differences exist
`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    verbose: boolean;
    githubFile: string;
    supabaseFile: string;
  } = {
    verbose: false,
    githubFile: path.join(OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_GITHUB),
    supabaseFile: path.join(OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_SUPABASE),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--verbose':
        options.verbose = true;
        break;
      case '--github-file':
        if (i + 1 >= args.length) {
          console.error('Error: --github-file requires a path argument');
          process.exit(1);
        }
        options.githubFile = args[++i];
        break;
      case '--supabase-file':
        if (i + 1 >= args.length) {
          console.error('Error: --supabase-file requires a path argument');
          process.exit(1);
        }
        options.supabaseFile = args[++i];
        break;
      case '--help':
      case '-h':
        displayHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          console.error('Use --help to see available options');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

/**
 * Load and parse JSON files with proper error handling
 */
async function loadJsonFiles(
  githubFile: string,
  supabaseFile: string,
): Promise<{
  github: AtlasCategoryJson[];
  supabase: AtlasCategoryJson[];
}> {
  try {
    const [githubContent, supabaseContent] = await Promise.all([
      readFile(githubFile, 'utf-8'),
      readFile(supabaseFile, 'utf-8'),
    ]);

    const github = JSON.parse(githubContent) as AtlasCategoryJson[];
    const supabase = JSON.parse(supabaseContent) as AtlasCategoryJson[];

    // Validate that we have arrays
    if (!Array.isArray(github)) {
      throw new Error(`GitHub file does not contain a valid array: ${githubFile}`);
    }
    if (!Array.isArray(supabase)) {
      throw new Error(`Supabase file does not contain a valid array: ${supabaseFile}`);
    }

    if (DEBUG_LOGGING()) {
      console.log(`Loaded ${github.length} GitHub categories and ${supabase.length} Supabase categories`);
    }

    return { github, supabase };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error loading JSON files: ${error.message}`);
    } else {
      console.error('Error loading JSON files:', error);
    }
    process.exit(1);
  }
}

/**
 * Find matching documents within a category using efficient algorithms
 * Filters out "Active Data" document types from comparison
 * Matches documents by name within the same document type (e.g., "Core", "Section")
 */
function findDocumentMatches(
  githubDocs: AtlasDocumentJson[],
  supabaseDocs: AtlasDocumentJson[],
): {
  matched: DocumentMatch[];
  githubOnly: AtlasDocumentJson[];
  supabaseOnly: AtlasDocumentJson[];
} {
  // Filter out "Active Data" document types
  const filteredGithubDocs = githubDocs.filter((doc) => doc.type !== 'Active Data');
  const filteredSupabaseDocs = supabaseDocs.filter((doc) => doc.type !== 'Active Data');

  const matched: DocumentMatch[] = [];
  const githubOnly: AtlasDocumentJson[] = [];
  const supabaseOnly: AtlasDocumentJson[] = [];

  // Use Set for O(1) lookup instead of array operations
  const matchedSupabaseIds = new Set<string>();

  // Group documents by type for more accurate matching
  const githubByType = new Map<string, AtlasDocumentJson[]>();
  const supabaseByType = new Map<string, AtlasDocumentJson[]>();

  for (const doc of filteredGithubDocs) {
    if (!githubByType.has(doc.type)) {
      githubByType.set(doc.type, []);
    }
    githubByType.get(doc.type)!.push(doc);
  }

  for (const doc of filteredSupabaseDocs) {
    if (!supabaseByType.has(doc.type)) {
      supabaseByType.set(doc.type, []);
    }
    supabaseByType.get(doc.type)!.push(doc);
  }

  // Match documents within each type
  for (const [docType, githubDocsOfType] of githubByType) {
    const supabaseDocsOfType = supabaseByType.get(docType) || [];

    // First pass: match by name within this type (case-insensitive but exact text)
    const nameMatches = new Map<string, AtlasDocumentJson[]>();
    for (const doc of supabaseDocsOfType) {
      const name = doc.name.toLowerCase(); // Case-insensitive but exact text match
      if (!nameMatches.has(name)) {
        nameMatches.set(name, []);
      }
      nameMatches.get(name)!.push(doc);
    }

    for (const githubDoc of githubDocsOfType) {
      const name = githubDoc.name.toLowerCase(); // Case-insensitive but exact text match
      const candidates = nameMatches.get(name) || [];

      if (candidates.length === 1) {
        // Perfect name match
        const supabaseDoc = candidates[0];
        matched.push({
          github: githubDoc,
          supabase: supabaseDoc,
          matchType: 'name',
        });
        matchedSupabaseIds.add(supabaseDoc.uuid || supabaseDoc.name);
      } else if (candidates.length > 1) {
        // Multiple name matches, try fallback matching
        const fallbackMatch = findFallbackMatch(githubDoc, candidates);
        if (fallbackMatch) {
          matched.push(fallbackMatch);
          matchedSupabaseIds.add(fallbackMatch.supabase.uuid || fallbackMatch.supabase.name);
        } else {
          githubOnly.push(githubDoc);
        }
      } else {
        // No name match, try fallback matching with all remaining docs of this type
        const remainingDocs = supabaseDocsOfType.filter((doc) => !matchedSupabaseIds.has(doc.uuid || doc.name));
        const fallbackMatch = findFallbackMatch(githubDoc, remainingDocs);
        if (fallbackMatch) {
          matched.push(fallbackMatch);
          matchedSupabaseIds.add(fallbackMatch.supabase.uuid || fallbackMatch.supabase.name);
        } else {
          githubOnly.push(githubDoc);
        }
      }
    }
  }

  // Collect unmatched Supabase documents (excluding Active Data)
  for (const doc of filteredSupabaseDocs) {
    if (!matchedSupabaseIds.has(doc.uuid || doc.name)) {
      supabaseOnly.push(doc);
    }
  }

  return { matched, githubOnly, supabaseOnly };
}

/**
 * Find fallback match using content and originalDocNumber when name matching fails
 * Uses case-insensitive but exact text matching for all fields
 * @param githubDoc The GitHub document to match
 * @param candidates Array of Supabase documents to search through
 * @returns DocumentMatch if found, null otherwise
 */
function findFallbackMatch(githubDoc: AtlasDocumentJson, candidates: AtlasDocumentJson[]): DocumentMatch | null {
  if (!candidates.length) {
    return null;
  }

  // Try content match first (most reliable) - case-insensitive but exact text
  const contentMatch = candidates.find(
    (candidate) => candidate.content.toLowerCase() === githubDoc.content.toLowerCase() && candidate.content !== '',
  );
  if (contentMatch) {
    return {
      github: githubDoc,
      supabase: contentMatch,
      matchType: 'content',
    };
  }

  // Try originalDocNumber match (fallback) - case-insensitive but exact text
  const docNumberMatch = candidates.find(
    (candidate) =>
      candidate.originalDocNumber.toLowerCase() === githubDoc.originalDocNumber.toLowerCase() &&
      candidate.originalDocNumber !== '',
  );
  if (docNumberMatch) {
    return {
      github: githubDoc,
      supabase: docNumberMatch,
      matchType: 'originalDocNumber',
    };
  }

  return null;
}

/**
 * Compare two Atlas JSON files and generate comprehensive diff results
 * @param github Array of GitHub Atlas categories
 * @param supabase Array of Supabase Atlas categories
 * @returns Comprehensive diff results
 */
function compareAtlasJson(github: AtlasCategoryJson[], supabase: AtlasCategoryJson[]): DiffResult {
  const categoryDiffs: CategoryDiff[] = [];
  let totalGithubDocs = 0;
  let totalSupabaseDocs = 0;

  // Create maps for easier lookup
  const githubMap = new Map<string, AtlasCategoryJson>();
  const supabaseMap = new Map<string, AtlasCategoryJson>();

  for (const category of github) {
    githubMap.set(category.type, category);
    // Count only non-Active Data documents
    const nonActiveDataDocs = category.documents.filter((doc) => doc.type !== 'Active Data');
    totalGithubDocs += nonActiveDataDocs.length;
  }

  for (const category of supabase) {
    supabaseMap.set(category.type, category);
    // Count only non-Active Data documents
    const nonActiveDataDocs = category.documents.filter((doc) => doc.type !== 'Active Data');
    totalSupabaseDocs += nonActiveDataDocs.length;
  }

  // Get all unique category types
  const allCategories = new Set([...githubMap.keys(), ...supabaseMap.keys()]);

  for (const categoryType of allCategories) {
    const githubCategory = githubMap.get(categoryType);
    const supabaseCategory = supabaseMap.get(categoryType);

    const githubDocs = githubCategory?.documents || [];
    const supabaseDocs = supabaseCategory?.documents || [];

    const { matched, githubOnly, supabaseOnly } = findDocumentMatches(githubDocs, supabaseDocs);

    // Count only non-Active Data documents for display
    const githubNonActiveDataCount = githubDocs.filter((doc) => doc.type !== 'Active Data').length;
    const supabaseNonActiveDataCount = supabaseDocs.filter((doc) => doc.type !== 'Active Data').length;

    const categoryDiff: CategoryDiff = {
      category: categoryType,
      githubCount: githubNonActiveDataCount,
      supabaseCount: supabaseNonActiveDataCount,
      matched,
      githubOnly,
      supabaseOnly,
    };

    categoryDiffs.push(categoryDiff);
  }

  const categoriesWithDifferences = categoryDiffs.filter(
    (diff) => diff.githubOnly.length > 0 || diff.supabaseOnly.length > 0,
  ).length;

  return {
    totalCategories: allCategories.size,
    categoriesWithDifferences,
    totalDocuments: {
      github: totalGithubDocs,
      supabase: totalSupabaseDocs,
    },
    categoryDiffs,
  };
}

/**
 * Format and display the diff results in a user-friendly format
 * @param result The diff results to display
 * @param verbose Whether to show detailed field differences
 */
function displayResults(result: DiffResult, verbose: boolean): void {
  console.log('\n=== Atlas JSON Diff Results ===\n');

  console.log(`Total Categories: ${result.totalCategories}`);
  console.log(`Categories with Differences: ${result.categoriesWithDifferences}`);
  console.log(`Total Documents - GitHub: ${result.totalDocuments.github}, Supabase: ${result.totalDocuments.supabase}`);

  if (result.categoriesWithDifferences === 0) {
    console.log('\n✅ No differences found between the two JSON files!');
    return;
  }

  console.log('\n=== Detailed Differences ===\n');

  for (const diff of result.categoryDiffs) {
    const hasDifferences = diff.githubOnly.length > 0 || diff.supabaseOnly.length > 0;

    if (!hasDifferences) continue;

    console.log(`📁 Category: ${diff.category}`);
    console.log(`   GitHub: ${diff.githubCount} docs, Supabase: ${diff.supabaseCount} docs`);

    if (diff.githubOnly.length > 0) {
      console.log(`   🔴 GitHub-only documents (${diff.githubOnly.length}):`);
      const docsToShow = diff.githubOnly.slice(0, 20);
      for (const doc of docsToShow) {
        console.log(`      - "${doc.name}" (${doc.originalDocNumber})`);
      }
      if (diff.githubOnly.length > 20) {
        console.log(`      ... and ${diff.githubOnly.length - 20} more`);
      }
    }

    if (diff.supabaseOnly.length > 0) {
      console.log(`   🔵 Supabase-only documents (${diff.supabaseOnly.length}):`);
      const docsToShow = diff.supabaseOnly.slice(0, 20);
      for (const doc of docsToShow) {
        console.log(`      - "${doc.name}" (${doc.originalDocNumber})`);
      }
      if (diff.supabaseOnly.length > 20) {
        console.log(`      ... and ${diff.supabaseOnly.length - 20} more`);
      }
    }

    if (verbose && diff.matched.length > 0) {
      console.log(`   ✅ Matched documents (${diff.matched.length}):`);
      const matchesToShow = diff.matched.slice(0, 20);
      for (const match of matchesToShow) {
        console.log(`      - "${match.github.name}" (matched by ${match.matchType})`);
      }
      if (diff.matched.length > 20) {
        console.log(`      ... and ${diff.matched.length - 20} more matches`);
      }
    }

    console.log('');
  }
}

/**
 * Main execution function with comprehensive error handling
 */
async function main(): Promise<void> {
  try {
    const options = parseArgs();

    if (DEBUG_LOGGING()) {
      console.log('Options:', options);
    }

    console.log('Loading Atlas JSON files...');
    const { github, supabase } = await loadJsonFiles(options.githubFile, options.supabaseFile);

    console.log('Comparing JSON files...');
    const result = compareAtlasJson(github, supabase);

    displayResults(result, options.verbose);

    // Exit with error code if differences found
    if (result.categoriesWithDifferences > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
