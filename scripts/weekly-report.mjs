import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Notice: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.');
  console.log('Skipping remote database sync for this run.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateReport() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`Generating weekly summary for transactions since ${oneWeekAgo}...`);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .gte('transaction_date', oneWeekAgo);

  if (error) {
    console.error('Error fetching transactions:', error.message);
    return;
  }

  const totalExpense =
    transactions
      ?.filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  const totalIncome =
    transactions
      ?.filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  console.log('----------------------------------------');
  console.log('WEEKLY SPENDING SUMMARY');
  console.log('----------------------------------------');
  console.log(`Total Transactions Logged : ${transactions?.length || 0}`);
  console.log(`Total Income             : $${totalIncome.toFixed(2)}`);
  console.log(`Total Expenses           : $${totalExpense.toFixed(2)}`);
  console.log(`Net Savings              : $${(totalIncome - totalExpense).toFixed(2)}`);
  console.log('----------------------------------------');

  if (geminiApiKey && transactions && transactions.length > 0) {
    try {
      console.log('Generating AI financial insights with Gemini Flash...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this weekly financial data and generate 3 concise, actionable financial recommendations: Total expenses: $${totalExpense.toFixed(2)}, Total income: $${totalIncome.toFixed(2)}, Transaction count: ${transactions.length}.`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('\nAI Weekly Financial Insights:');
        console.log(text);
      }
    } catch (e) {
      console.warn('AI insight generation skipped:', e.message);
    }
  }

  console.log('\nWeekly report task completed successfully.');
}

generateReport().catch(console.error);
