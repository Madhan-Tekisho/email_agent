import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Initialize database - since schema already exists in Supabase, 
// this just logs success. No need to run schema.sql via HTTP client.
export const initDb = async () => {
    try {
        // Test connection by querying departments
        const { data, error } = await supabase.from('departments').select('id').limit(1);
        if (error) {
            console.error('Database connection test failed:', error.message);
        } else {
            console.log('Database connected successfully via Supabase HTTP client');
        }
    } catch (err) {
        console.error('Error connecting to database:', err);
    }
};
