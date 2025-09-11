import { promises as fs } from 'fs';
import { join } from 'path';
import { AtlasDatabaseName } from '../atlas/constants';
import { EnhancedPageObjectResponse } from './fetch-database-pages';

const CACHE_DIR = '.notion-cache';

/**
 * Generate a cache file name for a database
 */
function getCacheFileName(atlasDatabaseName: AtlasDatabaseName): string {
  // Convert database name to a safe filename
  const safeName = atlasDatabaseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${safeName}.json`;
}

/**
 * Ensure the cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Directory might already exist, ignore error
  }
}

/**
 * Check if cached data exists for a database
 */
export async function hasCachedData(atlasDatabaseName: AtlasDatabaseName): Promise<boolean> {
  try {
    const cacheFile = join(CACHE_DIR, getCacheFileName(atlasDatabaseName));
    await fs.access(cacheFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load cached database pages
 */
export async function loadCachedDatabasePages(
  atlasDatabaseName: AtlasDatabaseName,
): Promise<EnhancedPageObjectResponse[] | null> {
  try {
    const cacheFile = join(CACHE_DIR, getCacheFileName(atlasDatabaseName));
    const data = await fs.readFile(cacheFile, 'utf-8');
    const parsed = JSON.parse(data);

    // Convert enhancedRelations back to Map from JSON object
    const enhancedPages: EnhancedPageObjectResponse[] = parsed.map(
      (page: { enhancedRelations?: Record<string, string[]> }) => ({
        ...page,
        enhancedRelations: new Map(Object.entries(page.enhancedRelations || {})),
      }),
    );

    console.log(`📁 Loaded ${enhancedPages.length} cached pages for database "${atlasDatabaseName}"`);
    return enhancedPages;
  } catch (error) {
    console.warn(`⚠️ Failed to load cached data for "${atlasDatabaseName}":`, error);
    return null;
  }
}

/**
 * Save database pages to cache
 */
export async function saveCachedDatabasePages(
  atlasDatabaseName: AtlasDatabaseName,
  pages: EnhancedPageObjectResponse[],
): Promise<void> {
  try {
    await ensureCacheDir();
    const cacheFile = join(CACHE_DIR, getCacheFileName(atlasDatabaseName));

    // Convert enhancedRelations Map to plain object for JSON serialization
    const serializable = pages.map((page) => ({
      ...page,
      enhancedRelations: Object.fromEntries(page.enhancedRelations),
    }));

    await fs.writeFile(cacheFile, JSON.stringify(serializable, null, 2));
    console.log(`💾 Saved ${pages.length} pages to cache for database "${atlasDatabaseName}"`);
  } catch (error) {
    console.warn(`⚠️ Failed to save cached data for "${atlasDatabaseName}":`, error);
  }
}
