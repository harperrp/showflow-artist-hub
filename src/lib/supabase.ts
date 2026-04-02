import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ ShowCRM: Variáveis VITE_SUPABASE_URL e a chave do Supabase (VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY) não configuradas. ' +
    'Adicione-as no painel de Secrets do Lovable ou em um arquivo .env.local.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
