import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FriendBalanceRow } from '../../../components/dashboard/FriendBalanceRow';

const base = { userId: 'u2', name: 'Bob', avatarUrl: undefined, currency: 'USD', sharedGroupIds: ['g1'] };

describe('FriendBalanceRow', () => {
    it('renders avatar and amount when friend owes you', () => {
        const { getByText, getByTestId } = render(
            <FriendBalanceRow friend={{ ...base, netBalance: 25 }} onPress={() => {}} testID="friend-u2" />,
        );
        expect(getByText('Bob')).toBeTruthy();
        expect(getByTestId('friend-u2-avatar')).toBeTruthy();
        expect(getByText(/25\.00/)).toBeTruthy();
        expect(getByText('dashboard.owesYou')).toBeTruthy();
    });

    it('shows settled state at zero', () => {
        const { getByText } = render(<FriendBalanceRow friend={{ ...base, netBalance: 0 }} onPress={() => {}} />);
        expect(getByText('dashboard.settled')).toBeTruthy();
    });

    it('triggers onPress with friend data', () => {
        const onPress = jest.fn();
        const friend = { ...base, netBalance: 5 };
        const { getByText } = render(<FriendBalanceRow friend={friend} onPress={onPress} />);
        fireEvent.press(getByText('Bob'));
        expect(onPress).toHaveBeenCalledWith(friend);
    });
});
