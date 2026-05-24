import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupDetailAppBar } from '../../components/groupDetail/GroupDetailAppBar';

describe('GroupDetailAppBar', () => {
  it('renders the default title', () => {
    const { getByText } = render(
      <GroupDetailAppBar onBack={() => {}} onShare={() => {}} onMenu={() => {}} />,
    );
    // The i18n mock returns the key when no override is provided.
    expect(getByText(/groups\.detail\.title/i)).toBeTruthy();
  });

  it('renders a title override when provided', () => {
    const { getByText } = render(
      <GroupDetailAppBar
        onBack={() => {}}
        onShare={() => {}}
        onMenu={() => {}}
        title="Paris Trip"
      />,
    );
    expect(getByText('Paris Trip')).toBeTruthy();
  });

  it('fires the three callbacks on tap', () => {
    const onBack = jest.fn();
    const onShare = jest.fn();
    const onMenu = jest.fn();
    const { getByTestId } = render(
      <GroupDetailAppBar onBack={onBack} onShare={onShare} onMenu={onMenu} />,
    );
    fireEvent.press(getByTestId('appbar-back'));
    fireEvent.press(getByTestId('appbar-share'));
    fireEvent.press(getByTestId('appbar-menu'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});
