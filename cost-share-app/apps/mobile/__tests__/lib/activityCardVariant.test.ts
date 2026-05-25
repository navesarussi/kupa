import { getActivityCardVariant } from '../../lib/activityCardVariant';

describe('getActivityCardVariant', () => {
    it('uses distinct icons per activity type', () => {
        const expense = getActivityCardVariant('expense');
        const settlement = getActivityCardVariant('settlement');
        const message = getActivityCardVariant('message');
        const friend = getActivityCardVariant('friend_request');

        expect(expense.iconName).toBe('receipt-outline');
        expect(settlement.iconName).toBe('swap-horizontal-outline');
        expect(message.iconName).toBe('chatbubble-outline');
        expect(friend.iconName).toBe('person-add-outline');
        expect(expense.showAmount).toBe(true);
        expect(message.showAmount).toBe(false);
        expect(friend.showAmount).toBe(false);
    });

    it('uses accepted styling for accepted friend requests', () => {
        const accepted = getActivityCardVariant('friend_request', 'accepted');
        expect(accepted.iconName).toBe('checkmark-circle-outline');
        expect(accepted.borderColor).toBe('#bbf7d0');
    });
});
