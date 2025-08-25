import { createClient } from '@supabase/supabase-js';
import { Database } from '@/app/server/services/supabase/database.types';

if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL in environment variables');
if (!process.env.SUPABASE_API_KEY) throw new Error('Missing SUPABASE_API_KEY in environment variables');

export const supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);
