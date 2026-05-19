import { computeMyDelta } from '../../services/expense-delta';
import type { ExpenseWithSplits } from '@cost-share/shared';

const makeExpense = (
    overrides: Partial<ExpenseWithSplits> = {},
): ExpenseWithSplits => ({
    id: 'e1',
    groupId: 'g1',
    description: 'Test',
    amount: 30,
    currency: 'USD',
    expenseDate: new Date(),
    paidBy: 'me',
    createdBy: 'me',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    splits: [
        { id: 's1', expenseId: 'e1', userId: 'me', amount: 10, createdAt: new Date() },
        { id: 's2', expenseId: 'e1', userId: 'other1', amount: 10, createdAt: new Date() },
        { id: 's3', expenseId: 'e1', userId: 'other2', amount: 10, createdAt: new Date() },
    ],
    ...overrides,
});

describe('computeMyDelta', () => {
    it('returns lent when I paid and my split is smaller', () => {
        const result = computeMyDelta(makeExpense(), 'me');
        expect(result).toEqual({ myDelta: 20, myDeltaState: 'lent' });
    });

    it('returns borrowed when I did not pay but owe a split', () => {
        const result = computeMyDelta(makeExpense({ paidBy: 'other1' }), 'me');
        expect(result).toEqual({ myDelta: -10, myDeltaState: 'borrowed' });
    });

    it('returns settled when I am not in splits and did not pay', () => {
        const expense = makeExpense({
            paidBy: 'other1',
            splits: [
                { id: 's2', expenseId: 'e1', userId: 'other1', amount: 15, createdAt: new Date() },
                { id: 's3', expenseId: 'e1', userId: 'other2', amount: 15, createdAt: new Date() },
            ],
        });
        const result = computeMyDelta(expense, 'me');
        expect(result).toEqual({ myDelta: 0, myDeltaState: 'settled' });
    });

    it('rounds to 2 decimals', () => {
        const expense = makeExpense({
            amount: 10,
            splits: [
                { id: 's1', expenseId: 'e1', userId: 'me', amount: 3.333, createdAt: new Date() },
            ],
        });
        const result = computeMyDelta(expense, 'me');
        expect(result.myDelta).toBeCloseTo(6.67, 2);
    });
});
