import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityItem } from '../../components/ActivityItem';
import type { RecentActivity } from '@cost-share/shared';

const expenseActivity: RecentActivity = {
    id: 'a1',
    activityType: 'expense',
    groupId: 'g1',
    description: 'Coffee',
    amount: 5.5,
    currency: 'USD',
    userId: 'u1',
    userName: 'Alice',
    activityDate: new Date('2026-05-01'),
    createdAt: new Date(),
};

const settlementActivity: RecentActivity = {
    ...expenseActivity,
    id: 's1',
    activityType: 'settlement',
    description: 'Payment',
};

describe('ActivityItem', () => {
    it('renders the description and user name', () => {
        const { getByText } = render(
            <ActivityItem activity={expenseActivity} groupName="Trip" />,
        );
        expect(getByText('Coffee')).toBeTruthy();
        expect(getByText(/Alice/)).toBeTruthy();
    });

    it('renders the amount with currency', () => {
        const { getByText } = render(<ActivityItem activity={expenseActivity} />);
        expect(getByText(/\$5\.50/)).toBeTruthy();
    });

    it('renders the actor avatar on the leading edge', () => {
        const { getByTestId } = render(<ActivityItem activity={expenseActivity} />);
        expect(getByTestId('activity-avatar')).toBeTruthy();
        expect(getByTestId('activity-card-thumbnail-icon')).toBeTruthy();
    });

    it('includes group name in meta when provided', () => {
        const { getByText } = render(
            <ActivityItem activity={expenseActivity} groupName="Weekend trip" />,
        );
        expect(getByText(/Weekend trip/)).toBeTruthy();
    });

    it('renders profile image when avatar url is provided', () => {
        const { getByTestId } = render(
            <ActivityItem
                activity={{
                    ...expenseActivity,
                    userAvatarUrl: 'https://example.com/alice.png',
                }}
            />,
        );
        expect(getByTestId('activity-avatar-image')).toBeTruthy();
    });

    it('calls onPress with the activity when the card is pressed', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <ActivityItem activity={expenseActivity} onPress={onPress} />,
        );
        fireEvent.press(getByTestId('activity-card-a1'));
        expect(onPress).toHaveBeenCalledWith(expenseActivity);
    });

    it('renders message body without amount', () => {
        const messageActivity: RecentActivity = {
            ...expenseActivity,
            id: 'm1',
            activityType: 'message',
            description: 'See you tonight',
            amount: 0,
            currency: '',
        };
        const { getByText, queryByText, getByTestId } = render(
            <ActivityItem activity={messageActivity} onPress={jest.fn()} />,
        );
        expect(getByText('See you tonight')).toBeTruthy();
        expect(getByTestId('activity-avatar')).toBeTruthy();
        expect(queryByText(/USD/)).toBeNull();
    });

    it('renders friend request variant with distinct styling', () => {
        const friendActivity: RecentActivity = {
            ...expenseActivity,
            id: 'fr1',
            activityType: 'friend_request',
            description: '',
            amount: 0,
            currency: '',
        };
        const { getByTestId } = render(
            <ActivityItem activity={friendActivity} groupName="Friends" />,
        );
        expect(getByTestId('activity-card-fr1')).toBeTruthy();
    });

    it('renders settlement amount on its own line', () => {
        const { getByTestId } = render(
            <ActivityItem activity={settlementActivity} />,
        );
        expect(getByTestId('activity-card-s1')).toBeTruthy();
        expect(getByTestId('activity-card-amount')).toBeTruthy();
    });
});
