import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SummaryFooter } from '../../components/groupDetail/SummaryFooter';

describe('SummaryFooter', () => {
  const base = {
    settlementCount: 1,
    noteHasContent: false,
    onOpenNote: jest.fn(),
    onOpenSettleUp: jest.fn(),
  };

  it('shows pluralized "payments to settle" text when there are open payments', () => {
    const { getByText } = render(<SummaryFooter {...base} settlementCount={1} />);
    expect(getByText(/balances\.paymentsToSettle/i)).toBeTruthy();
  });

  it('shows "No open payments" when there are no open payments', () => {
    const { getByText } = render(
      <SummaryFooter {...base} settlementCount={0} />,
    );
    expect(getByText(/groups\.summary\.noOpenPayments/i)).toBeTruthy();
  });

  it('shows the amber dot when noteHasContent is true', () => {
    const { getByTestId } = render(
      <SummaryFooter {...base} noteHasContent />,
    );
    expect(getByTestId('summary-note-dot')).toBeTruthy();
  });

  it('hides the amber dot when noteHasContent is false', () => {
    const { queryByTestId } = render(<SummaryFooter {...base} />);
    expect(queryByTestId('summary-note-dot')).toBeNull();
  });

  it('keeps the settle-up pill enabled when there are no open payments', () => {
    const onOpenSettleUp = jest.fn();
    const { getByTestId } = render(
      <SummaryFooter {...base} settlementCount={0} onOpenSettleUp={onOpenSettleUp} />,
    );
    fireEvent.press(getByTestId('summary-settle-pill'));
    expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenNote / onOpenSettleUp on tap', () => {
    const onOpenNote = jest.fn();
    const onOpenSettleUp = jest.fn();
    const { getByTestId } = render(
      <SummaryFooter
        {...base}
        onOpenNote={onOpenNote}
        onOpenSettleUp={onOpenSettleUp}
      />,
    );
    fireEvent.press(getByTestId('summary-note-pill'));
    fireEvent.press(getByTestId('summary-settle-pill'));
    expect(onOpenNote).toHaveBeenCalledTimes(1);
    expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
  });
});
