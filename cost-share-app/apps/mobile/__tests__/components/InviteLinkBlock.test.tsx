import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InviteLinkBlock } from '../../components/InviteLinkBlock';

const mockShare = jest.fn();
const mockRotate = jest.fn();
jest.mock('../../hooks/useInviteLink', () => ({
    useInviteLink: () => ({
        url: 'https://kupa.pro/i/AbCdEfGhIj',
        isReady: true,
        share: mockShare,
        rotate: mockRotate,
    }),
}));

describe('<InviteLinkBlock />', () => {
    beforeEach(() => {
        mockShare.mockClear();
        mockRotate.mockClear();
    });

    it('renders the URL display', () => {
        const { getByText } = render(<InviteLinkBlock mode="expanded" kind="friend" />);
        expect(getByText(/kupa\.pro\/i\/AbCdEfGhIj/)).toBeTruthy();
    });

    it('calls share() when share button pressed', () => {
        const { getByTestId } = render(<InviteLinkBlock mode="expanded" kind="friend" />);
        fireEvent.press(getByTestId('invite-link-share'));
        expect(mockShare).toHaveBeenCalled();
    });

    it('calls rotate() when rotate button pressed', () => {
        const { getByTestId } = render(<InviteLinkBlock mode="expanded" kind="friend" />);
        fireEvent.press(getByTestId('invite-link-rotate'));
        expect(mockRotate).toHaveBeenCalled();
    });
});
