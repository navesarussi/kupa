/**
 * Deep-link focus for GroupDetail feed rows (from Activity / notifications).
 */

import type { FeedItem } from '@cost-share/shared';

export type GroupDetailFocusFeedItem =
    | { kind: 'expense'; id: string }
    | { kind: 'settlement'; id: string };

export function feedItemMatchesFocus(
    item: FeedItem,
    focus: GroupDetailFocusFeedItem,
): boolean {
    if (focus.kind === 'expense') {
        return item.kind === 'expense' && item.expense.id === focus.id;
    }
    return item.kind === 'settlement' && item.settlement.id === focus.id;
}

export function findFeedItemIndex(
    feed: FeedItem[],
    focus: GroupDetailFocusFeedItem,
): number {
    return feed.findIndex((item) => feedItemMatchesFocus(item, focus));
}
