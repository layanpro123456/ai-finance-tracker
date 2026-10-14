import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseUrl = rawUrl.replace(/[<>]/g, '').trim();
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
});

import {
  validateAndSanitizePrompt,
  validateAndSanitizeParsedTransaction,
} from './services/aiSecurityGuard';

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  transaction_date: string;
  raw_prompt: string;
}

// Resilient local fallback parser
function parseLocally(prompt: string): ParsedTransaction {
  const today = new Date().toISOString().split('T')[0];
  const lower = prompt.toLowerCase();

  // Extract amount ($12.50, Rs 1500, 1500 LKR, 12.50, etc.)
  const amountMatch = prompt.match(/(?:[$€£₹]|(?:rs\.?|lkr)\s*)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // Determine type
  const isIncome = /\b(earned|salary|income|freelance|received|dividend|bonus|sold|deposit)\b/i.test(lower);
  const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';

  // Category determination
  let category = 'Other';
  if (/\b(groceries|supermarket|walmart|trader joe|kroger|costco|aldi|food market|keells|cargills)\b/i.test(lower)) {
    category = 'Groceries';
  } else if (/\b(lunch|dinner|breakfast|restaurant|cafe|coffee|starbucks|chipotle|mcdonald|burger|pizza|bar|dining)\b/i.test(lower)) {
    category = 'Dining Out';
  } else if (/\b(rent|electricity|water|wifi|internet|gas bill|utility|mortgage|ceb|water board)\b/i.test(lower)) {
    category = 'Housing & Utilities';
  } else if (/\b(uber|lyft|taxi|subway|bus|metro|gas|petrol|fuel|parking|train|tuk|pickme)\b/i.test(lower)) {
    category = 'Transportation';
  } else if (/\b(movie|cinema|netflix|spotify|game|concert|gym|ticket)\b/i.test(lower)) {
    category = 'Entertainment';
  } else if (/\b(doctor|pharmacy|medicine|hospital|dentist|health|fitness|asiri|nawaloka)\b/i.test(lower)) {
    category = 'Health & Fitness';
  } else if (isIncome && /\b(salary|paycheck)\b/i.test(lower)) {
    category = 'Salary';
  } else if (isIncome && /\b(freelance|client|gig)\b/i.test(lower)) {
    category = 'Freelance';
  } else if (isIncome && /\b(dividend|stock|crypto|investment)\b/i.test(lower)) {
    category = 'Investments';
  }

  // Extract clean description
  let description = prompt
    .replace(/(?:[$€£₹]|(?:rs\.?|lkr)\s*)?\s*[0-9]+(?:\.[0-9]{1,2})?/gi, '')
    .replace(/\b(spent|spent on|paid|paid for|bought|earned|on|at|today|yesterday|with|card|cash)\b/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  if (!description) {
    description = category;
  }

  return validateAndSanitizeParsedTransaction(
    {
      amount,
      type,
      category,
      description,
      transaction_date: today,
      raw_prompt: prompt,
    },
    prompt
  );
}

export async function parseTransaction(prompt: string): Promise<ParsedTransaction> {
  // Step 1: Client-side prompt sanitization and adversarial check
  const validation = validateAndSanitizePrompt(prompt);
  if (!validation.isValid) {
    throw new Error(validation.threatReason || 'Adversarial instruction detected. Prompts are restricted to personal transactions.');
  }

  const cleanPrompt = validation.sanitizedPrompt;

  try {
    // Retrieve current user token if available
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || supabaseAnonKey;

    const { data, error } = await supabase.functions.invoke('parse-transaction', {
      body: { prompt: cleanPrompt },
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!error && data?.data) {
      return validateAndSanitizeParsedTransaction(data.data, cleanPrompt);
    }

    if (error) {
      console.warn('Edge function returned error, using secure local parser:', error.message);
    }
  } catch (err) {
    console.warn('Could not reach parse-transaction edge function, using secure local fallback:', err);
  }

  // Graceful local parser fallback with strict validation
  return parseLocally(cleanPrompt);
}
