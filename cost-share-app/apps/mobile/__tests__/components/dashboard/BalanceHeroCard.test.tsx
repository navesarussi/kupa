import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BalanceHeroCard } from '../../../components/dashboard/BalanceHeroCard';

const single = { totalOwed: 50, totalOwedToUser: 100, defaultCurrency: 'ILS',
    byCurrency: [{ currency: 'ILS', owed: 50, owedToUser: 100 }] };
const zero = { totalOwed: 0, totalOwedToUser: 0, defaultCurrency: 'ILS', byCurrency: [] };
const multi = { totalOwed: null, totalOwedToUser: null, defaultCurrency: 'ILS',
    byCurrency: [{ currency: 'ILS', owed: 0, owedToUser: 100 }, { currency: 'USD', owed: 150, owedToUser: 0 }] };

describe('BalanceHeroCard', () => {
    it('renders headline numbers when single currency', () => {
        const { getByText } = render(<BalanceHeroCard summary={single as any} />);
        expect(getByText('dashboard.youOwe')).toBeTruthy();
        expect(getByText(/50\.00/)).toBeTruthy();
        expect(getByText(/100\.00/)).toBeTruthy();
    });

    it('renders friendly zero labels instead of 0 amounts', () => {
        const { getByText } = render(<BalanceHeroCard summary={zero as any} />);
        expect(getByText('dashboard.nothingOwed')).toBeTruthy();
        expect(getByText('dashboard.notOwedToYou')).toBeTruthy();
    });

    it('renders em-dash and breakdown by default when multi-currency', () => {
        const { getAllByText, getByText } = render(<BalanceHeroCard summary={multi as any} />);
        expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
        expect(getByText('USD')).toBeTruthy();
    });

    it('toggles breakdown for single currency', () => {
        const { getByTestId, getByText } = render(<BalanceHeroCard summary={single as any} />);
        fireEvent.press(getByTestId('balance-hero-toggle'));
        expect(getByText('ILS')).toBeTruthy();
    });
});
