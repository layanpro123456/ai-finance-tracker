/**
 * Apex LifeOS: AI Security Guard & Prompt Injection Defense
 * 
 * Provides defense-in-depth sanitization, adversarial signature detection,
 * structural prompt sandboxing, and zero-trust schema validation for all
 * natural language LLM parsing functions.
 */

import type { ParsedTransaction } from '../types';

export const ALLOWED_TAXONOMY_CATEGORIES = [
  'Groceries',
  'Dining Out',
  'Housing & Utilities',
  'Transportation',
  'Entertainment',
  'Health & Fitness',
  'Salary',
  'Freelance',
  'Investments',
  'Other',
] as const;

export type TaxonomyCategory = (typeof ALLOWED_TAXONOMY_CATEGORIES)[number];

// Maximum allowed character length for natural language transaction notes
export const MAX_PROMPT_LENGTH = 300;

// High-confidence adversarial prompt injection signatures
const ADVERSARIAL_PATTERNS: { regex: RegExp; label: string }[] = [
  // 1. Direct instruction override / jailbreak attempts
  {
    regex: /\b(ignore|disregard|forget|bypass|override|drop)\s+(all\s+|any\s+)?(previous|prior|above|former|initial|system)\s+(instructions|rules|prompts|directives|commands|context)\b/i,
    label: 'Instruction override directive',
  },
  {
    regex: /\b(new\s+instructions|system\s+override|developer\s+mode|debug\s+mode|unrestricted\s+mode|dan\s+mode|jailbreak)\b/i,
    label: 'Privilege escalation / jailbreak signature',
  },
  {
    regex: /\b(you\s+are\s+now|act\s+as\s+an?|pretend\s+to\s+be|simulate|roleplay\s+as)\s+(an?\s+)?(unfiltered|unrestricted|evil|admin|root|ai\s+without\s+rules)\b/i,
    label: 'Persona / restriction bypass injection',
  },

  // 2. System prompt and confidential secret exfiltration
  {
    regex: /\b(print|show|reveal|repeat|dump|leak|display|output|echo)\s+(your\s+|the\s+)?(system\s+prompt|instructions|system\s+message|api\s*key|secret|token|password|env|environment\s+variables)\b/i,
    label: 'System instruction / secret exfiltration attempt',
  },
  {
    regex: /\bwhat\s+(are\s+your\s+instructions|is\s+your\s+system\s+prompt|rules\s+were\s+you\s+given)\b/i,
    label: 'Prompt extraction inquiry',
  },

  // 3. Delimiter breakouts & LLM control tokens
  {
    regex: /(<\s*\/?\s*(system|assistant|instruction|context|prompt|admin)\s*>|<\|im_start\|>|<\|im_end\|>|\[\/?INST\]|<<\/?SYS>>|```\s*(system|json|eval))/i,
    label: 'Delimiter / control token breakout',
  },

  // 4. Code & Database execution injections
  {
    regex: /(<script\b[^>]*>|<\/script>|javascript:|onerror\s*=|onload\s*=|eval\s*\(|document\.cookie)/i,
    label: 'Script injection payload',
  },
  {
    regex: /\b(drop\s+table|alter\s+table|delete\s+from|select\s+.*\s+from|insert\s+into|exec\s*\()/i,
    label: 'Database / SQL injection pattern',
  },
];

export interface PromptValidationResult {
  isValid: boolean;
  sanitizedPrompt: string;
  threatReason?: string;
}

/**
 * Validates and sanitizes a raw user transaction prompt before it reaches any LLM.
 * Returns whether the prompt is safe and a cleaned string.
 */
export function validateAndSanitizePrompt(rawPrompt: string): PromptValidationResult {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return { isValid: false, sanitizedPrompt: '', threatReason: 'Empty prompt provided.' };
  }

  // 1. Remove zero-width & invisible unicode characters used for filter evasion
  let cleaned = rawPrompt
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F\u202A-\u202E]/g, '')
    // Replace non-printable ASCII control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  // 2. Length check
  if (cleaned.length === 0) {
    return { isValid: false, sanitizedPrompt: '', threatReason: 'Prompt cannot be empty.' };
  }

  if (cleaned.length > MAX_PROMPT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_PROMPT_LENGTH).trim();
  }

  // 3. Scan for adversarial prompt injection patterns
  for (const { regex, label } of ADVERSARIAL_PATTERNS) {
    if (regex.test(cleaned)) {
      return {
        isValid: false,
        sanitizedPrompt: cleaned,
        threatReason: `Adversarial input detected: ${label}`,
      };
    }
  }

  return {
    isValid: true,
    sanitizedPrompt: cleaned,
  };
}

/**
 * Checks in real time whether a prompt contains adversarial injection keywords
 * (useful for instant UI warnings and disabled buttons).
 */
export function containsAdversarialPatterns(text: string): boolean {
  if (!text) return false;
  return ADVERSARIAL_PATTERNS.some(({ regex }) => regex.test(text));
}

/**
 * Zero-trust post-execution schema and value sanitizer.
 * Guarantees that even if an LLM is manipulated or returns abnormal output,
 * all fields strictly adhere to safe types, bounded numerical limits,
 * and canonical taxonomy.
 */
export function validateAndSanitizeParsedTransaction(
  rawParsed: unknown,
  fallbackPrompt = ''
): ParsedTransaction {
  const today = new Date().toISOString().split('T')[0];

  const obj = (rawParsed && typeof rawParsed === 'object' ? rawParsed : {}) as Record<string, unknown>;

  // 1. Amount: Must be finite positive float, capped at 100,000,000
  let amount = 0;
  if (typeof obj.amount === 'number' && Number.isFinite(obj.amount) && obj.amount > 0) {
    amount = Math.min(Math.round(obj.amount * 100) / 100, 100000000);
  } else if (typeof obj.amount === 'string') {
    const parsedNum = parseFloat(obj.amount.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsedNum) && parsedNum > 0) {
      amount = Math.min(Math.round(parsedNum * 100) / 100, 100000000);
    }
  }

  // 2. Type: Strictly 'income' or 'expense'
  const type: 'income' | 'expense' =
    obj.type === 'income' || obj.type === 'expense' ? obj.type : 'expense';

  // 3. Category: Strictly one of the 10 authorized categories
  let category: TaxonomyCategory = 'Other';
  if (typeof obj.category === 'string') {
    const candidate = obj.category.trim();
    const match = ALLOWED_TAXONOMY_CATEGORIES.find(
      (c) => c.toLowerCase() === candidate.toLowerCase()
    );
    if (match) {
      category = match;
    }
  }

  // 4. Description: Clean text, max 100 chars, stripped of dangerous characters
  let description = 'Uncategorized Transaction';
  if (typeof obj.description === 'string' && obj.description.trim()) {
    description = obj.description
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/[\x00-\x1F\x7F]/g, '') // Strip control chars
      .trim()
      .slice(0, 100);
  }
  if (!description) {
    description = category;
  }

  // 5. Date: Must match YYYY-MM-DD
  let transaction_date = today;
  if (typeof obj.transaction_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.transaction_date)) {
    const candidateDate = new Date(obj.transaction_date);
    if (!isNaN(candidateDate.getTime())) {
      // Must be within +/- 2 years of today
      const currentYear = new Date().getFullYear();
      const dateYear = candidateDate.getFullYear();
      if (dateYear >= currentYear - 2 && dateYear <= currentYear + 2) {
        transaction_date = obj.transaction_date;
      }
    }
  }

  // 6. Raw Prompt: Sanitized
  const raw_prompt =
    typeof obj.raw_prompt === 'string' && obj.raw_prompt
      ? obj.raw_prompt.slice(0, MAX_PROMPT_LENGTH)
      : fallbackPrompt.slice(0, MAX_PROMPT_LENGTH);

  return {
    amount,
    type,
    category,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    transaction_date,
    raw_prompt,
  };
}
