import { ImportLogCreateInput } from '@/app/server/database/import-log';
import { supabase } from './supabase-client';

/**
 * Log an import operation to the import_logs table
 */
export async function logImportOperation(logData: ImportLogCreateInput): Promise<void> {
  try {
    const { error } = await supabase().from('import_logs').insert([logData]).throwOnError();

    if (error) {
      console.error('Failed to log import operation:', error);
      // Don't throw here - logging failure shouldn't break the import
    } else {
      console.log('Import operation logged successfully');
    }
  } catch (error) {
    console.error('Error logging import operation:', error);
    // Don't throw here - logging failure shouldn't break the import
  }
}
