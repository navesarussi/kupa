import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => {
    const { View } = require('react-native');
    return { LinearGradient: View };
});

import { SummaryCover } from '../../components/groupDetail/SummaryCover';

const mockGroup = (overrides: Partial<any> = {}): any => ({
  id: 'g1',
  name: 'Paris Trip',
  groupType: 'trip',
  imageUrl: undefined,
  defaultCurrency: 'USD',
  ...overrides,
});

describe('SummaryCover', () => {
  it('renders gradient variant when no imageUrl', () => {
    const { getByTestId, queryByTestId } = render(
      <SummaryCover group={mockGroup()} members={[]} />,
    );
    expect(getByTestId('summary-cover-gradient')).toBeTruthy();
    expect(queryByTestId('summary-cover-image')).toBeNull();
  });

  it('renders image variant when imageUrl is set', () => {
    const { getByTestId, queryByTestId } = render(
      <SummaryCover
        group={mockGroup({ imageUrl: 'https://example.com/x.jpg' })}
        members={[]}
      />,
    );
    expect(getByTestId('summary-cover-image')).toBeTruthy();
    expect(queryByTestId('summary-cover-gradient')).toBeNull();
  });

  it('renders the group name', () => {
    const { getByText } = render(
      <SummaryCover
        group={mockGroup({ name: 'Paris Trip' })}
        members={[
          { userId: 'u1', displayName: 'A', isActive: true },
          { userId: 'u2', displayName: 'B', isActive: true },
        ]}
      />,
    );
    expect(getByText('Paris Trip')).toBeTruthy();
  });
});
