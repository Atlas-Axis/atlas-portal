import { createClient } from '@supabase/supabase-js';
import { Database } from '@/app/server/services/supabase/database.types';

let _supabase: ReturnType<typeof createClient<Database>> | undefined;

export function supabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL in environment variables');
    if (!process.env.SUPABASE_API_KEY) throw new Error('Missing SUPABASE_API_KEY in environment variables');
    _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);
  }
  return _supabase;
}
