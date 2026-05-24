import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupSummaryCard } from '../../components/groupDetail/GroupSummaryCard';
import { Group, GroupMemberLite } from '@cost-share/shared';

const group = {
  id: 'g1',
  name: 'Paris Trip',
  groupType: 'trip',
  defaultCurrency: 'USD',
} as unknown as Group;

const members: GroupMemberLite[] = [
  { userId: 'u1', displayName: 'A', isActive: true },
  { userId: 'u2', displayName: 'B', isActive: true },
];

describe('GroupSummaryCard', () => {
  it('renders the cover, balance strip, and footer', () => {
    const { getByText, getByTestId } = render(
      <GroupSummaryCard
        group={group}
        members={members}
        balance={{ net: 42, currency: 'USD', isSettled: false }}
        settlementCount={1}
        noteHasContent={false}
        onOpenBalances={() => {}}
        onOpenNote={() => {}}
        onOpenSettleUp={() => {}}
      />,
    );
    expect(getByText('Paris Trip')).toBeTruthy();
    expect(getByText(/USD 42\.00/)).toBeTruthy();
    expect(getByTestId('summary-note-pill')).toBeTruthy();
    expect(getByTestId('summary-settle-pill')).toBeTruthy();
  });

  it('routes the three tap targets to their handlers', () => {
    const onOpenBalances = jest.fn();
    const onOpenNote = jest.fn();
    const onOpenSettleUp = jest.fn();
    const { getByTestId } = render(
      <GroupSummaryCard
        group={group}
        members={members}
        balance={{ net: 42, currency: 'USD', isSettled: false }}
        settlementCount={1}
        noteHasContent={false}
        onOpenBalances={onOpenBalances}
        onOpenNote={onOpenNote}
        onOpenSettleUp={onOpenSettleUp}
      />,
    );
    fireEvent.press(getByTestId('summary-balance-strip'));
    fireEvent.press(getByTestId('summary-note-pill'));
    fireEvent.press(getByTestId('summary-settle-pill'));
    expect(onOpenBalances).toHaveBeenCalledTimes(1);
    expect(onOpenNote).toHaveBeenCalledTimes(1);
    expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
  });
});
