import { buildFeed } from '../../services/feed';
import type { ExpenseWithSplits, GroupMessage } from '@cost-share/shared';

const exp = (id: string, createdAt: Date, groupId = 'g1'): ExpenseWithSplits => ({
    id,
    groupId,
    description: `expense ${id}`,
    amount: 10,
    currency: 'USD',
    expenseDate: createdAt,
    paidBy: 'me',
    createdBy: 'me',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
    splits: [
        { id: `${id}-s1`, expenseId: id, userId: 'me', amount: 5, createdAt },
        { id: `${id}-s2`, expenseId: id, userId: 'other', amount: 5, createdAt },
    ],
});

const msg = (id: string, createdAt: Date, groupId = 'g1'): GroupMessage => ({
    id,
    groupId,
    userId: 'me',
    body: `m ${id}`,
    editedAt: null,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
});

describe('buildFeed', () => {
    it('interleaves and sorts by createdAt DESC', () => {
        const t = (s: string) => new Date(s);
        const feed = buildFeed(
            'g1',
            [exp('e1', t('2026-01-01')), exp('e2', t('2026-01-03'))],
            [msg('m1', t('2026-01-02')), msg('m2', t('2026-01-04'))],
            'me',
        );
        expect(feed.map(i => (i.kind === 'expense' ? `e:${i.expense.id}` : `m:${i.message.id}`))).toEqual([
            'm:m2',
            'e:e2',
            'm:m1',
            'e:e1',
        ]);
    });

    it('skips expenses from other groups', () => {
        const t = (s: string) => new Date(s);
        const feed = buildFeed(
            'g1',
            [exp('e1', t('2026-01-01'), 'g1'), exp('e2', t('2026-01-02'), 'g2')],
            [],
            'me',
        );
        expect(feed).toHaveLength(1);
    });

    it('skips deleted messages', () => {
        const t = (s: string) => new Date(s);
        const m = msg('m1', t('2026-01-02'));
        m.isDeleted = true;
        const feed = buildFeed('g1', [], [m], 'me');
        expect(feed).toHaveLength(0);
    });

    it('decorates expense items with myDelta', () => {
        const feed = buildFeed('g1', [exp('e1', new Date())], [], 'me');
        const item = feed[0];
        if (item.kind !== 'expense') throw new Error('expected expense');
        expect(item.expense.myDelta).toBeCloseTo(5, 2);
        expect(item.expense.myDeltaState).toBe('lent');
    });
});
