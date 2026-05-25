import { findFeedItemIndex } from '../../lib/groupDetailFocus';
import type { FeedItem } from '@cost-share/shared';

const feed: FeedItem[] = [
    {
        kind: 'message',
        message: {
            id: 'm1',
            groupId: 'g1',
            userId: 'u1',
            body: 'hi',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    },
    {
        kind: 'expense',
        expense: {
            id: 'e1',
            groupId: 'g1',
            description: 'Lunch',
            amount: 10,
            currency: 'USD',
            category: 'food',
            expenseDate: new Date(),
            paidBy: 'u1',
            createdBy: 'u1',
            createdAt: new Date(),
            updatedAt: new Date(),
            splits: [],
            myDelta: 0,
            myDeltaState: 'even',
        },
    },
];

describe('findFeedItemIndex', () => {
    it('finds expense index in feed', () => {
        expect(findFeedItemIndex(feed, { kind: 'expense', id: 'e1' })).toBe(1);
    });

    it('returns -1 when item is missing', () => {
        expect(findFeedItemIndex(feed, { kind: 'settlement', id: 's9' })).toBe(-1);
    });
});
