import React from 'react';
import { render } from '@testing-library/react-native';
import {
    ActivityItemCard,
    resolveActivityTitle,
} from '../../components/ActivityItemCard';
import type { RecentActivity } from '@cost-share/shared';

const base: RecentActivity = {
    id: '1',
    activityType: 'expense',
    groupId: 'g1',
    description: 'Coffee',
    amount: 5.5,
    currency: 'USD',
    userId: 'u1',
    userName: 'Alice',
    activityDate: new Date(),
    createdAt: new Date(),
};

const t = (key: string, opts?: Record<string, string>) => {
    if (key === 'activity.notifications.friendRequest') {
        return `Friend request from ${opts?.name}`;
    }
    return key;
};

describe('resolveActivityTitle', () => {
    it('builds notification copy for friend requests', () => {
        const title = resolveActivityTitle(
            { ...base, activityType: 'friend_request', description: '' },
            undefined,
            t as never,
        );
        expect(title).toBe('Friend request from Alice');
    });

    it('builds accepted friend request copy', () => {
        const title = resolveActivityTitle(
            {
                ...base,
                activityType: 'friend_request',
                friendRequestStatus: 'accepted',
                description: '',
            },
            undefined,
            ((key: string, opts?: Record<string, string>) => {
                if (key === 'activity.notifications.friendRequestAccepted') {
                    return `Friends with ${opts?.name}`;
                }
                return key;
            }) as never,
        );
        expect(title).toBe('Friends with Alice');
    });
});

describe('ActivityItemCard', () => {
    it('renders group name on its own line for expenses', () => {
        const { getByText } = render(
            <ActivityItemCard
                activity={base}
                title="Coffee"
                meta="Alice · now"
                groupName="Trip"
                testID="card"
            />,
        );
        expect(getByText('Trip')).toBeTruthy();
        expect(getByText(/\$5\.50/)).toBeTruthy();
    });

    it('omits amount for messages', () => {
        const { queryByTestId } = render(
            <ActivityItemCard
                activity={{
                    ...base,
                    activityType: 'message',
                    amount: 0,
                    currency: '',
                }}
                title="Hello"
                meta="Alice · now"
                testID="card"
            />,
        );
        expect(queryByTestId('activity-card-amount')).toBeNull();
    });
});
