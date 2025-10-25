
import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials for direct use, as requested.
const supabaseUrl = 'https://ziqpgyblusoqoqzqodjj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppcXBneWJsdXNvcW9xenFvZGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMjYzNDMsImV4cCI6MjA3NjkwMjM0M30.2R8QZ7QFldKGEWuvdykyccj-7G_cRMVKrbbnoa_oIzk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
