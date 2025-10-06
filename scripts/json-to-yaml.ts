import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { stringify } from 'yaml';

/**
 * Command line tool to convert JSON to YAML
 *
 * Usage:
 *   npx tsx scripts/json-to-yaml.ts [input-file]
 *   npx tsx scripts/json-to-yaml.ts --help
 *
 * If no input file is provided, defaults to:
 *   .debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json
 *
 * Output file will be in the same directory as input with .yaml extension
 */

interface ConversionOptions {
  indent: number;
  lineWidth: number;
  minContentWidth: number;
  noRefs: boolean;
  sortKeys: boolean;
}

const DEFAULT_OPTIONS: ConversionOptions = {
  indent: 2,
  lineWidth: 120,
  minContentWidth: 0,
  noRefs: true,
  sortKeys: false,
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

function showUsage(): void {
  console.log(`
JSON to YAML Converter

Usage:
  npx tsx scripts/json-to-yaml.ts [input-file]
  npx tsx scripts/json-to-yaml.ts --help

Arguments:
  input-file    Path to the JSON file to convert (optional)
                Default: .debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json

Options:
  --help        Show this help message

Output:
  The YAML file will be created in the same directory as the input file
  with the same name but with a .yaml extension.

Examples:
  npx tsx scripts/json-to-yaml.ts data.json
  npx tsx scripts/json-to-yaml.ts
`);
}

function validateInputFile(filePath: string): void {
  // Check if file exists
  if (!existsSync(filePath)) {
    throw new Error(`Input file does not exist: ${filePath}`);
  }

  // Check if it's a file (not a directory)
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }

  // Check file size
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `Input file is too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    );
  }

  // Check file extension
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.json') {
    console.warn(`⚠️  Warning: Input file doesn't have .json extension: ${filePath}`);
  }
}

function convertJsonToYaml(inputFile: string): string {
  try {
    // Read the JSON file
    console.log(`Reading JSON file: ${inputFile}`);
    const jsonContent = readFileSync(inputFile, 'utf8');

    // Check if file is empty
    if (jsonContent.trim().length === 0) {
      throw new Error('Input file is empty');
    }

    // Parse JSON
    let jsonData: unknown;
    try {
      jsonData = JSON.parse(jsonContent);
    } catch (parseError) {
      throw new Error(
        `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
      );
    }

    // Convert to YAML
    const yamlContent = stringify(jsonData, DEFAULT_OPTIONS);

    return yamlContent;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to convert JSON to YAML: ${error.message}`);
    }
    throw new Error('Unknown error during conversion');
  }
}

function writeYamlFile(yamlContent: string, inputFile: string): string {
  // Generate output file path
  const inputDir = dirname(inputFile);
  const inputBaseName = basename(inputFile, extname(inputFile));
  const outputFile = join(inputDir, `${inputBaseName}.yaml`);

  try {
    // Write YAML file
    console.log(`Writing YAML file: ${outputFile}`);
    writeFileSync(outputFile, yamlContent, 'utf8');
    return outputFile;
  } catch (error) {
    throw new Error(`Failed to write output file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function main(): void {
  const args = process.argv.slice(2);

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  // Get input file path from command line arguments
  const inputFile = args[0] || '.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json';

  try {
    // Resolve the input file path
    const resolvedInputFile = resolve(inputFile);

    // Validate input file
    validateInputFile(resolvedInputFile);

    // Convert JSON to YAML
    const yamlContent = convertJsonToYaml(resolvedInputFile);

    // Write YAML file
    const outputFile = writeYamlFile(yamlContent, resolvedInputFile);

    // Success message
    console.log('✅ Conversion completed successfully!');
    console.log(`📁 Input:  ${resolvedInputFile}`);
    console.log(`📁 Output: ${outputFile}`);
  } catch (error) {
    console.error('❌ Error during conversion:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${String(error)}`);
    }
    console.error('\nUse --help for usage information.');
    process.exit(1);
  }
}

// Run the main function
main();
