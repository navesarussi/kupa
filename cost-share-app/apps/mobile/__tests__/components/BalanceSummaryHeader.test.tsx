import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceSummaryHeader } from '../../components/BalanceSummaryHeader';

describe('BalanceSummaryHeader', () => {
    it('renders nothing when rows is empty', () => {
        const { toJSON } = render(<BalanceSummaryHeader rows={[]} />);
        expect(toJSON()).toBeNull();
    });

    it('renders nothing when every row rounds to zero', () => {
        const { toJSON } = render(
            <BalanceSummaryHeader
                rows={[{ currency: 'USD', owed: 0.001, owe: 0, net: 0 }]}
            />,
        );
        expect(toJSON()).toBeNull();
    });

    it('renders only the owed line when owe is zero', () => {
        const { queryByText } = render(
            <BalanceSummaryHeader
                rows={[{ currency: 'USD', owed: 12.5, owe: 0, net: 12.5 }]}
            />,
        );
        expect(queryByText('groups.summary.youAreOwed')).toBeTruthy();
        expect(queryByText('groups.summary.youOwe')).toBeNull();
    });

    it('renders both owed and owe lines across currencies', () => {
        const { queryAllByText } = render(
            <BalanceSummaryHeader
                rows={[
                    { currency: 'USD', owed: 10, owe: 5, net: 5 },
                    { currency: 'ILS', owed: 0, owe: 33, net: -33 },
                ]}
            />,
        );
        expect(queryAllByText('groups.summary.youAreOwed').length).toBe(1);
        expect(queryAllByText('groups.summary.youOwe').length).toBe(2);
    });
});
