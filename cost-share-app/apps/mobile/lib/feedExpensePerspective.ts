/**
 * User-relative copy for expense rows in the group feed.
 */

import type { ExpenseWithSplits } from '@cost-share/shared';

export type ExpenseFeedPerspective =
    | 'youPaid'
    | 'paidForYou'
    | 'paidForYouAndOthers'
    | 'paidExcludingYou';

export interface ExpenseFeedPerspectiveParams {
    perspective: ExpenseFeedPerspective;
    /** Total split participants (for youPaid / paidExcludingYou pluralization). */
    splitCount: number;
    /** Other splitters besides the current user (paidForYouAndOthers). */
    othersCount: number;
}

export function resolveExpenseFeedPerspective(
    expense: ExpenseWithSplits,
    currentUserId: string,
): ExpenseFeedPerspectiveParams {
    const splitCount = expense.splits.length;
    const isPayer = expense.paidBy === currentUserId;
    const isInSplit = expense.splits.some(s => s.userId === currentUserId);

    if (isPayer) {
        return {
            perspective: 'youPaid',
            splitCount,
            othersCount: 0,
        };
    }

    if (isInSplit) {
        const othersCount = Math.max(0, splitCount - 1);
        return {
            perspective:
                othersCount === 0 ? 'paidForYou' : 'paidForYouAndOthers',
            splitCount,
            othersCount,
        };
    }

    return {
        perspective: 'paidExcludingYou',
        splitCount,
        othersCount: 0,
    };
}

export function expenseFeedSummaryKey(
    perspective: ExpenseFeedPerspective,
): string {
    switch (perspective) {
        case 'youPaid':
            return 'groups.expense.feedYouPaid';
        case 'paidForYou':
            return 'groups.expense.feedPaidForYou';
        case 'paidForYouAndOthers':
            return 'groups.expense.feedPaidForYouAndOthers';
        case 'paidExcludingYou':
            return 'groups.expense.feedPaidExcludingYou';
    }
}

export function expenseFeedSummaryCount(
    params: ExpenseFeedPerspectiveParams,
): number {
    switch (params.perspective) {
        case 'youPaid':
        case 'paidExcludingYou':
            return params.splitCount;
        case 'paidForYouAndOthers':
            return params.othersCount;
        case 'paidForYou':
            return 1;
    }
}
