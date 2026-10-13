import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  transaction_date: string;
  raw_prompt: string;
}

export async function parseTransaction(prompt: string): Promise<ParsedTransaction> {
  const { data, error } = await supabase.functions.invoke('parse-transaction', {
    body: { prompt },
  });

  if (error) {
    throw error;
  }

  return data?.data as ParsedTransaction;
}
