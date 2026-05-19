/**
 * Feed selector — builds a FeedItem[] for GroupDetailScreen
 * by interleaving the group's expenses and messages, sorted by createdAt DESC.
 */

import {
    ExpenseWithSplits,
    GroupMessage,
    FeedItem,
} from '@cost-share/shared';
import { decorateExpense } from './expense-delta';

export function buildFeed(
    groupId: string,
    expenses: ExpenseWithSplits[],
    messages: GroupMessage[],
    currentUserId: string,
): FeedItem[] {
    const expenseItems: FeedItem[] = expenses
        .filter(e => e.groupId === groupId && !e.isDeleted)
        .map(e => ({
            kind: 'expense',
            sortAt: e.createdAt,
            expense: decorateExpense(e, currentUserId),
        }));

    const messageItems: FeedItem[] = messages
        .filter(m => !m.isDeleted)
        .map(m => ({
            kind: 'message',
            sortAt: m.createdAt,
            message: m,
        }));

    return [...expenseItems, ...messageItems].sort(
        (a, b) => b.sortAt.getTime() - a.sortAt.getTime(),
    );
}
