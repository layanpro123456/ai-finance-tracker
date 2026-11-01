import { describe, it, expect } from 'vitest';
import { previewTransactionUndo, previewTransactionUpdate } from './transactionUndoService';
import type { Transaction } from '../types';

describe('Transaction Undo Service', () => {
  it('should calculate correct refund for expense undo', () => {
    const expenseTx: Transaction = {
      id: 'tx-1',
      user_id: 'user-1',
      account_id: 'acc-1',
      category_id: 'cat-1',
      amount: 75.5,
      type: 'expense',
      description: 'Dinner at restaurant',
      transaction_date: '2026-10-22',
      created_at: new Date().toISOString(),
    };

    const preview = previewTransactionUndo(expenseTx, 200.0);
    expect(preview.delta).toBe(75.5);
    expect(preview.actionType).toBe('refund');
    expect(preview.projectedBalance).toBe(275.5);
  });

  it('should calculate correct deduction for income undo', () => {
    const incomeTx: Transaction = {
      id: 'tx-2',
      user_id: 'user-1',
      account_id: 'acc-1',
      category_id: 'cat-2',
      amount: 1500,
      type: 'income',
      description: 'Bonus payment',
      transaction_date: '2026-10-22',
      created_at: new Date().toISOString(),
    };

    const preview = previewTransactionUndo(incomeTx, 3000.0);
    expect(preview.delta).toBe(-1500);
    expect(preview.actionType).toBe('deduction');
    expect(preview.projectedBalance).toBe(1500);
  });
});

describe('Transaction Update Service', () => {
  const baseTx: Transaction = {
    id: 'tx-100',
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: 'cat-1',
    amount: 50.0,
    type: 'expense',
    description: 'Grocery shopping',
    transaction_date: '2026-10-25',
  };

  it('calculates correct netDelta when increasing an expense on the same account', () => {
    // Current balance is 500. Was expense 50, now expense 75.
    // Account balance should decrease by 25 (from 500 to 475)
    const preview = previewTransactionUpdate(baseTx, 75.0, 'expense', 'acc-1', 500.0);
    expect(preview.isSameAccount).toBe(true);
    expect(preview.netDelta).toBe(-25.0);
    expect(preview.projectedBalance).toBe(475.0);
  });

  it('calculates correct netDelta when decreasing an expense on the same account', () => {
    // Current balance is 500. Was expense 50, now expense 30.
    // Account balance should increase by 20 (from 500 to 520)
    const preview = previewTransactionUpdate(baseTx, 30.0, 'expense', 'acc-1', 500.0);
    expect(preview.isSameAccount).toBe(true);
    expect(preview.netDelta).toBe(20.0);
    expect(preview.projectedBalance).toBe(520.0);
  });

  it('calculates correct netDelta when changing an expense to income', () => {
    // Was expense 50, now income 50.
    // Reversing expense (+50) + adding income (+50) = +100.
    const preview = previewTransactionUpdate(baseTx, 50.0, 'income', 'acc-1', 500.0);
    expect(preview.isSameAccount).toBe(true);
    expect(preview.netDelta).toBe(100.0);
    expect(preview.projectedBalance).toBe(600.0);
  });

  it('handles changing accounts properly', () => {
    // Old account acc-1 had 500 balance. New account acc-2 has 300 balance.
    // Was expense 50 on acc-1. Now expense 80 on acc-2.
    // acc-1 is refunded 50 (550). acc-2 is deducted 80 (220).
    const preview = previewTransactionUpdate(baseTx, 80.0, 'expense', 'acc-2', 500.0, 300.0);
    expect(preview.isSameAccount).toBe(false);
    expect(preview.oldAccountDelta).toBe(50.0);
    expect(preview.oldAccountProjectedBalance).toBe(550.0);
    expect(preview.newAccountDelta).toBe(-80.0);
    expect(preview.newAccountProjectedBalance).toBe(220.0);
  });
});
