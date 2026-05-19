import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QuickActionsRow } from '../../components/QuickActionsRow';

describe('QuickActionsRow', () => {
    it('renders all three labels', () => {
        const { getByText, queryByText } = render(
            <QuickActionsRow
                onSettleUp={() => {}}
                onBalances={() => {}}
                onExport={() => {}}
            />,
        );
        expect(getByText('groups.actions.settleUp')).toBeTruthy();
        expect(getByText('groups.actions.balances')).toBeTruthy();
        expect(getByText('groups.actions.export')).toBeTruthy();
        expect(queryByText('groups.actions.message')).toBeNull();
    });

    it('disables the Settle up action when settleUpDisabled is true', () => {
        const onSettleUp = jest.fn();
        const { getByTestId } = render(
            <QuickActionsRow
                onSettleUp={onSettleUp}
                onBalances={() => {}}
                onExport={() => {}}
                settleUpDisabled
            />,
        );
        fireEvent.press(getByTestId('qa-settle-up'));
        expect(onSettleUp).not.toHaveBeenCalled();
    });

    it('fires onExport when the export chip is tapped', () => {
        const onExport = jest.fn();
        const { getByTestId } = render(
            <QuickActionsRow
                onSettleUp={() => {}}
                onBalances={() => {}}
                onExport={onExport}
            />,
        );
        fireEvent.press(getByTestId('qa-export'));
        expect(onExport).toHaveBeenCalled();
    });
});
