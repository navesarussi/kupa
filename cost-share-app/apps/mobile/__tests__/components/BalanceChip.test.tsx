import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceChip } from '../../components/BalanceChip';

describe('BalanceChip', () => {
    it('shows Settled label when balance is undefined', () => {
        const { getByText } = render(<BalanceChip defaultCurrency="USD" />);
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('shows Settled label when balance.net rounds to zero', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                balance={{ groupId: 'g', currency: 'USD', net: 0.004 }}
            />,
        );
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('formats a positive balance with + and the currency', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                balance={{ groupId: 'g', currency: 'ILS', net: 17 }}
            />,
        );
        expect(getByText('+ILS 17.00')).toBeTruthy();
    });

    it('formats a negative balance using an absolute value', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                balance={{ groupId: 'g', currency: 'USD', net: -8.5 }}
            />,
        );
        expect(getByText('−USD 8.50')).toBeTruthy();
    });
});
