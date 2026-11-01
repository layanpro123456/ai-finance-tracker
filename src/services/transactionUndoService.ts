import { supabase } from '../supabaseClient';
import type { Transaction, Account } from '../types';
import { logPlatformEvent } from './adminTelemetry';

export interface UndoTransactionResult {
  success: boolean;
  transactionId: string;
  accountId: string;
  accountName: string;
  previousBalance: number;
  newBalance: number;
  delta: number;
  message: string;
}

export interface UndoPreview {
  delta: number;
  actionType: 'refund' | 'deduction';
  actionDescription: string;
  previousBalance: number;
  projectedBalance: number;
}

export interface UpdatePreview {
  isSameAccount: boolean;
  oldAccountId: string;
  newAccountId: string;
  netDelta: number;
  previousBalance: number;
  projectedBalance: number;
  oldAccountDelta: number;
  oldAccountPrevBalance: number;
  oldAccountProjectedBalance: number;
  newAccountDelta: number;
  newAccountPrevBalance: number;
  newAccountProjectedBalance: number;
  description: string;
}

export interface UpdateTransactionParams {
  transactionId: string;
  originalTransaction: Transaction;
  newDescription: string;
  newAmount: number;
  newType: 'income' | 'expense';
  newAccountId: string;
  newCategoryId?: string | null;
  newTransactionDate: string;
  accountsFallback?: Account[];
  operator?: {
    userId?: string;
    userEmail?: string;
    isAdminAction?: boolean;
  };
}

export interface UpdateTransactionResult {
  success: boolean;
  transactionId: string;
  message: string;
}

/**
 * Calculates what the balance change will be when a transaction is undone.
 */
export function previewTransactionUndo(
  transaction: Transaction,
  currentAccountBalance: number
): UndoPreview {
  const amount = Number(transaction.amount) || 0;
  // If expense: spending is reversed, adding money back
  // If income: income is reversed, deducting money
  const isExpense = transaction.type === 'expense';
  const delta = isExpense ? amount : -amount;
  const projectedBalance = Number((currentAccountBalance + delta).toFixed(2));

  return {
    delta,
    actionType: isExpense ? 'refund' : 'deduction',
    actionDescription: isExpense
      ? `Refunds ${amount.toFixed(2)} back to account balance`
      : `Deducts ${amount.toFixed(2)} from account balance`,
    previousBalance: currentAccountBalance,
    projectedBalance,
  };
}

/**
 * Calculates what the balance change will be when a transaction is edited and saved.
 */
export function previewTransactionUpdate(
  originalTransaction: Transaction,
  newAmount: number,
  newType: 'income' | 'expense',
  newAccountId: string,
  oldAccountBalance: number,
  newAccountBalance?: number
): UpdatePreview {
  const oldAmt = Number(originalTransaction.amount) || 0;
  const oldType = originalTransaction.type;
  const isSame = originalTransaction.account_id === newAccountId;

  // Reversing old transaction
  const reversalDelta = oldType === 'expense' ? oldAmt : -oldAmt;
  // Applying new transaction
  const applicationDelta = newType === 'income' ? newAmount : -newAmount;

  if (isSame) {
    const netDelta = Number((reversalDelta + applicationDelta).toFixed(2));
    const projectedBalance = Number((oldAccountBalance + netDelta).toFixed(2));
    const description =
      netDelta >= 0
        ? `Account balance will increase by ${netDelta.toFixed(2)}`
        : `Account balance will decrease by ${Math.abs(netDelta).toFixed(2)}`;

    return {
      isSameAccount: true,
      oldAccountId: originalTransaction.account_id,
      newAccountId,
      netDelta,
      previousBalance: oldAccountBalance,
      projectedBalance,
      oldAccountDelta: netDelta,
      oldAccountPrevBalance: oldAccountBalance,
      oldAccountProjectedBalance: projectedBalance,
      newAccountDelta: netDelta,
      newAccountPrevBalance: oldAccountBalance,
      newAccountProjectedBalance: projectedBalance,
      description,
    };
  } else {
    const oldProj = Number((oldAccountBalance + reversalDelta).toFixed(2));
    const newPrev = newAccountBalance ?? 0;
    const newProj = Number((newPrev + applicationDelta).toFixed(2));
    const description = `Previous account adjusted by ${reversalDelta >= 0 ? '+' : ''}${reversalDelta.toFixed(2)}, new account adjusted by ${applicationDelta >= 0 ? '+' : ''}${applicationDelta.toFixed(2)}`;

    return {
      isSameAccount: false,
      oldAccountId: originalTransaction.account_id,
      newAccountId,
      netDelta: 0,
      previousBalance: oldAccountBalance,
      projectedBalance: oldProj,
      oldAccountDelta: reversalDelta,
      oldAccountPrevBalance: oldAccountBalance,
      oldAccountProjectedBalance: oldProj,
      newAccountDelta: applicationDelta,
      newAccountPrevBalance: newPrev,
      newAccountProjectedBalance: newProj,
      description,
    };
  }
}

/**
 * Reverts a financial transaction and synchronizes account balance transaction-wise.
 * Also cleans up any dependent ERP references (tasks, assets, social contacts).
 */
export async function undoAccountTransaction(
  transaction: Transaction,
  accountFallback?: Account,
  operator?: {
    userId?: string;
    userEmail?: string;
    isAdminAction?: boolean;
  }
): Promise<UndoTransactionResult> {
  const amount = Number(transaction.amount) || 0;
  const isExpense = transaction.type === 'expense';
  const delta = isExpense ? amount : -amount;

  // 1. Fetch current account balance from Supabase or fallback
  let accountName = accountFallback?.name || 'Account';
  let currentBalance = accountFallback ? Number(accountFallback.balance) : 0;

  try {
    const { data: dbAccount, error: accFetchError } = await supabase
      .from('accounts')
      .select('id, name, balance')
      .eq('id', transaction.account_id)
      .maybeSingle();

    if (!accFetchError && dbAccount) {
      accountName = dbAccount.name;
      currentBalance = Number(dbAccount.balance);
    }
  } catch (err) {
    console.warn('Could not fetch live account record, using memory fallback:', err);
  }

  const newBalance = Number((currentBalance + delta).toFixed(2));

  // 2. Delete transaction record from transactions table
  const { error: delError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transaction.id);

  if (delError) {
    throw new Error(`Failed to remove transaction: ${delError.message}`);
  }

  // 3. Atomically update account balance
  const { error: accUpdateError } = await supabase
    .from('accounts')
    .update({ balance: newBalance })
    .eq('id', transaction.account_id);

  if (accUpdateError) {
    console.warn('Account balance update failed:', accUpdateError.message);
  }

  // 4. Detach any linked records in ERP modules
  try {
    // A. Unlink financial tasks
    await supabase
      .from('tasks')
      .update({ related_transaction_id: null })
      .eq('related_transaction_id', transaction.id);

    // B. Unlink personal assets
    await supabase
      .from('personal_assets')
      .update({ linked_transaction_id: null })
      .eq('linked_transaction_id', transaction.id);

    // C. Unlink settled debts in contacts ledger
    await supabase
      .from('contacts_ledger')
      .update({
        settled_transaction_id: null,
        is_settled: false,
        settled_at: null,
      })
      .eq('settled_transaction_id', transaction.id);
  } catch (cleanErr) {
    console.warn('Non-critical error unlinking ERP foreign keys:', cleanErr);
  }

  // 5. Audit trail telemetry logging
  const actionPrefix = operator?.isAdminAction ? 'Admin undid' : 'User undid';
  const logMessage = `${actionPrefix} ${transaction.type} transaction "${transaction.description}" (${amount.toFixed(2)}) on ${accountName} (Balance: ${currentBalance.toFixed(2)} ➔ ${newBalance.toFixed(2)})`;

  logPlatformEvent(
    'TRANSACTION',
    logMessage,
    operator?.userId || transaction.user_id,
    operator?.userEmail
  );

  return {
    success: true,
    transactionId: transaction.id,
    accountId: transaction.account_id,
    accountName,
    previousBalance: currentBalance,
    newBalance,
    delta,
    message: `Successfully reverted "${transaction.description}". ${accountName} balance updated from ${currentBalance.toFixed(2)} to ${newBalance.toFixed(2)}.`,
  };
}

/**
 * Updates a financial transaction's details, synchronizes account balances accordingly,
 * and records the modification in the system audit log.
 */
export async function updateAccountTransaction(
  params: UpdateTransactionParams
): Promise<UpdateTransactionResult> {
  const {
    transactionId,
    originalTransaction,
    newDescription,
    newAmount,
    newType,
    newAccountId,
    newCategoryId,
    newTransactionDate,
    accountsFallback = [],
    operator,
  } = params;

  const oldAmt = Number(originalTransaction.amount) || 0;
  const oldType = originalTransaction.type;
  const isSame = originalTransaction.account_id === newAccountId;

  const reversalDelta = oldType === 'expense' ? oldAmt : -oldAmt;
  const applicationDelta = newType === 'income' ? newAmount : -newAmount;

  if (isSame) {
    const netDelta = Number((reversalDelta + applicationDelta).toFixed(2));

    let currentBalance = 0;
    const fallbackAcc = accountsFallback.find((a) => a.id === newAccountId);
    if (fallbackAcc) {
      currentBalance = Number(fallbackAcc.balance);
    }

    try {
      const { data: dbAccount, error: accErr } = await supabase
        .from('accounts')
        .select('id, name, balance')
        .eq('id', newAccountId)
        .maybeSingle();

      if (!accErr && dbAccount) {
        currentBalance = Number(dbAccount.balance);
      }
    } catch (e) {
      console.warn('Could not fetch live account balance:', e);
    }

    const updatedBalance = Number((currentBalance + netDelta).toFixed(2));

    if (netDelta !== 0) {
      const { error: accUpdErr } = await supabase
        .from('accounts')
        .update({ balance: updatedBalance })
        .eq('id', newAccountId);

      if (accUpdErr) {
        throw new Error(`Failed to update account balance: ${accUpdErr.message}`);
      }
    }
  } else {
    // Different accounts: reverse on old account, apply on new account
    let oldBalance = 0;
    const oldFallback = accountsFallback.find((a) => a.id === originalTransaction.account_id);
    if (oldFallback) oldBalance = Number(oldFallback.balance);

    try {
      const { data: dbOldAcc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', originalTransaction.account_id)
        .maybeSingle();
      if (dbOldAcc) oldBalance = Number(dbOldAcc.balance);
    } catch (e) {
      console.warn('Could not fetch live old account:', e);
    }

    let newBalance = 0;
    const newFallback = accountsFallback.find((a) => a.id === newAccountId);
    if (newFallback) newBalance = Number(newFallback.balance);

    try {
      const { data: dbNewAcc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', newAccountId)
        .maybeSingle();
      if (dbNewAcc) newBalance = Number(dbNewAcc.balance);
    } catch (e) {
      console.warn('Could not fetch live new account:', e);
    }

    const updatedOldBalance = Number((oldBalance + reversalDelta).toFixed(2));
    const updatedNewBalance = Number((newBalance + applicationDelta).toFixed(2));

    const { error: oldUpdErr } = await supabase
      .from('accounts')
      .update({ balance: updatedOldBalance })
      .eq('id', originalTransaction.account_id);

    if (oldUpdErr) {
      throw new Error(`Failed to update previous account balance: ${oldUpdErr.message}`);
    }

    const { error: newUpdErr } = await supabase
      .from('accounts')
      .update({ balance: updatedNewBalance })
      .eq('id', newAccountId);

    if (newUpdErr) {
      throw new Error(`Failed to update destination account balance: ${newUpdErr.message}`);
    }
  }

  // 3. Update the transaction row
  const { error: txUpdErr } = await supabase
    .from('transactions')
    .update({
      description: newDescription.trim() || 'Transaction',
      amount: newAmount,
      type: newType,
      account_id: newAccountId,
      category_id: newCategoryId || null,
      transaction_date: newTransactionDate,
    })
    .eq('id', transactionId);

  if (txUpdErr) {
    throw new Error(`Failed to save transaction details: ${txUpdErr.message}`);
  }

  // 4. Audit trail
  const actionPrefix = operator?.isAdminAction ? 'Admin updated' : 'User updated';
  const logMessage = `${actionPrefix} transaction "${newDescription}" (${newType} ${newAmount.toFixed(2)}) on date ${newTransactionDate}`;
  logPlatformEvent(
    'TRANSACTION',
    logMessage,
    operator?.userId || originalTransaction.user_id,
    operator?.userEmail
  );

  return {
    success: true,
    transactionId,
    message: `Transaction "${newDescription}" updated and saved successfully.`,
  };
}
