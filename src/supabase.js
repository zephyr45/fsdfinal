import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jrutpnivfhwdihvgxxam.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydXRwbml2Zmh3ZGlodmd4eGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzU1MjgsImV4cCI6MjA2MjgxMTUyOH0.JNmT5c_pX6WSZZKjp7REXTPIRhKtL08kxATFFzXENhk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default supabase;
