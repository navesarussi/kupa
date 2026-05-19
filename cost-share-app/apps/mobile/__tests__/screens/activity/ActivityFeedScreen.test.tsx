import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
        useRoute: () => ({ params: {} }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/activity.service', () => ({
    fetchRecentActivity: jest.fn(),
}));

import { ActivityFeedScreen } from '../../../screens/activity/ActivityFeedScreen';
import { fetchRecentActivity } from '../../../services/activity.service';

const mockFetchRecentActivity = fetchRecentActivity as jest.MockedFunction<
    typeof fetchRecentActivity
>;

beforeEach(() => {
    mockFetchRecentActivity.mockReset();
});

describe('ActivityFeedScreen', () => {
    it('renders the Kupa header', async () => {
        mockFetchRecentActivity.mockResolvedValue([]);
        const { findByText } = render(<ActivityFeedScreen />);
        expect(await findByText('Kupa')).toBeTruthy();
    });

    it('shows empty state when no activities', async () => {
        mockFetchRecentActivity.mockResolvedValue([]);
        const { findByText } = render(<ActivityFeedScreen />);
        expect(await findByText('activity.noActivity')).toBeTruthy();
    });

    it('renders activities when present', async () => {
        mockFetchRecentActivity.mockResolvedValue([
            {
                id: 'a1',
                activityType: 'expense',
                groupId: 'g1',
                description: 'Lunch',
                amount: 12,
                currency: 'USD',
                userId: 'u1',
                userName: 'Alice',
                activityDate: new Date('2026-05-01'),
                createdAt: new Date(),
            },
        ]);
        const { findByText } = render(<ActivityFeedScreen />);
        expect(await findByText('Lunch')).toBeTruthy();
    });

    it('filters activities by search query', async () => {
        mockFetchRecentActivity.mockResolvedValue([
            {
                id: 'a1',
                activityType: 'expense',
                groupId: 'g1',
                description: 'Lunch',
                amount: 12,
                currency: 'USD',
                userId: 'u1',
                userName: 'Alice',
                activityDate: new Date('2026-05-01'),
                createdAt: new Date(),
            },
            {
                id: 'a2',
                activityType: 'expense',
                groupId: 'g1',
                description: 'Dinner',
                amount: 20,
                currency: 'USD',
                userId: 'u2',
                userName: 'Bob',
                activityDate: new Date('2026-05-02'),
                createdAt: new Date(),
            },
        ]);

        const { findByText, findByTestId, queryByText } = render(<ActivityFeedScreen />);
        expect(await findByText('Lunch')).toBeTruthy();

        fireEvent.press(await findByText('activity.search'));
        fireEvent.changeText(await findByTestId('activity-search-input'), 'Dinner');

        expect(await findByText('Dinner')).toBeTruthy();
        expect(queryByText('Lunch')).toBeNull();
    });
});
