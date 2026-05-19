/**
 * Pure helpers for deriving the current user's per-expense delta.
 * Kept separate from expenses.service.ts so the helpers can be imported
 * in tests without dragging in supabase / toast / i18n side effects.
 */

import {
    ExpenseWithDelta,
    ExpenseWithSplits,
} from '@cost-share/shared';

export function computeMyDelta(
    expense: ExpenseWithSplits,
    currentUserId: string,
): { myDelta: number; myDeltaState: 'lent' | 'borrowed' | 'settled' } {
    const paidByMe = expense.paidBy === currentUserId ? expense.amount : 0;
    const mySplit = expense.splits.find(s => s.userId === currentUserId)?.amount ?? 0;
    const raw = paidByMe - mySplit;
    const myDelta = Number(raw.toFixed(2));
    const myDeltaState: 'lent' | 'borrowed' | 'settled' =
        Math.abs(myDelta) < 0.01 ? 'settled' : myDelta > 0 ? 'lent' : 'borrowed';
    return { myDelta, myDeltaState };
}

export function decorateExpense(
    expense: ExpenseWithSplits,
    currentUserId: string,
): ExpenseWithDelta {
    return { ...expense, ...computeMyDelta(expense, currentUserId) };
}
