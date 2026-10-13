// Supabase Edge Function: parse-transaction
// Natural language transaction parser using Google Gemini Flash
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  transaction_date: string;
  raw_prompt: string;
}

// Fallback rule-based parser when GEMINI_API_KEY is not configured
function parseHeuristically(prompt: string): ParsedTransaction {
  const today = new Date().toISOString().split('T')[0];
  const lower = prompt.toLowerCase();

  // Extract amount ($12.50, 12.50, 15)
  const amountMatch = prompt.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // Determine type
  const isIncome = /\b(earned|salary|income|freelance|received|dividend|bonus|sold)\b/.test(lower);
  const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';

  // Category determination
  let category = 'Other';
  if (/\b(groceries|supermarket|walmart|trader joe|kroger|costco|aldi|food market)\b/.test(lower)) {
    category = 'Groceries';
  } else if (/\b(lunch|dinner|breakfast|restaurant|cafe|coffee|starbucks|chipotle|mcdonald|burger|pizza|bar)\b/.test(lower)) {
    category = 'Dining Out';
  } else if (/\b(rent|electricity|water|wifi|internet|gas bill|utility|mortgage)\b/.test(lower)) {
    category = 'Housing & Utilities';
  } else if (/\b(uber|lyft|taxi|subway|bus|metro|gas|petrol|fuel|parking|train)\b/.test(lower)) {
    category = 'Transportation';
  } else if (/\b(movie|cinema|netflix|spotify|game|concert|gym|ticket)\b/.test(lower)) {
    category = 'Entertainment';
  } else if (/\b(doctor|pharmacy|medicine|hospital|dentist|health|fitness)\b/.test(lower)) {
    category = 'Health & Fitness';
  } else if (isIncome && /\b(salary|paycheck)\b/.test(lower)) {
    category = 'Salary';
  } else if (isIncome && /\b(freelance|client|gig)\b/.test(lower)) {
    category = 'Freelance';
  } else if (isIncome && /\b(dividend|stock|crypto|investment)\b/.test(lower)) {
    category = 'Investments';
  }

  // Extract description: cleanup prompt
  let description = prompt
    .replace(/\$?\s*[0-9]+(?:\.[0-9]{1,2})?/, '')
    .replace(/\b(spent|spent on|paid|paid for|bought|earned|on|at|today|yesterday)\b/gi, '')
    .trim();
  if (!description) {
    description = category;
  }

  return {
    amount,
    type,
    category,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    transaction_date: today,
    raw_prompt: prompt,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt || body.text || '';

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Please provide a prompt string.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set. Using heuristic parser.');
      const parsed = parseHeuristically(prompt);
      return new Response(
        JSON.stringify({ data: parsed, source: 'heuristic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are a personal finance assistant.
Extract transaction details from the given text into structured JSON.
Current date: ${today}

Valid categories:
- Groceries
- Dining Out
- Housing & Utilities
- Transportation
- Entertainment
- Health & Fitness
- Salary
- Freelance
- Investments
- Other

Output ONLY a JSON object matching this schema:
{
  "amount": number (positive float, e.g. 14.50),
  "type": "income" or "expense",
  "category": "one of the valid categories above",
  "description": "clean concise merchant or purpose, e.g. Chipotle",
  "transaction_date": "YYYY-MM-DD" (infer relative dates like yesterday or default to current date: ${today})
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: `User input: "${prompt}"` }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API call failed:', errText);
      // Fallback to heuristic parser so user request does not fail
      const parsed = parseHeuristically(prompt);
      return new Response(
        JSON.stringify({ data: parsed, source: 'heuristic_fallback', warning: 'Gemini API call failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      throw new Error('Empty response received from AI model');
    }

    const cleanedJson = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsedData = JSON.parse(cleanedJson);
    parsedData.raw_prompt = prompt;

    return new Response(
      JSON.stringify({ data: parsedData, source: 'gemini' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Error handling parse-transaction:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
