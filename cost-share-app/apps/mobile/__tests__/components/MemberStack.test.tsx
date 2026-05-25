import React from 'react';
import { render } from '@testing-library/react-native';
import {
    MemberStack,
    getMemberStackLayout,
    memberStackRowWidth,
} from '../../components/groupDetail/MemberStack';
import { GroupMemberLite } from '@cost-share/shared';

const member = (i: number): GroupMemberLite => ({
    userId: `u${i}`,
    displayName: `User ${i}`,
    isActive: true,
});

describe('getMemberStackLayout', () => {
    it('uses full size for a small group', () => {
        expect(getMemberStackLayout(4, 200).size).toBe(32);
    });

    it('shrinks avatars when many members must fit one row', () => {
        const { size } = getMemberStackLayout(10, 160);
        expect(size).toBeLessThan(32);
        expect(memberStackRowWidth(10, size)).toBeLessThanOrEqual(160);
    });
});

describe('MemberStack', () => {
    it('renders every member avatar', () => {
        const members = [1, 2, 3, 4, 5, 6].map(member);
        const { getAllByTestId, queryByTestId } = render(
            <MemberStack members={members} maxWidth={200} testID="stack" />,
        );
        expect(getAllByTestId('member-avatar').length).toBe(6);
        expect(queryByTestId('stack-overflow')).toBeNull();
    });

    it('does not render an overflow tile', () => {
        const { queryByTestId } = render(
            <MemberStack
                members={[member(1), member(2), member(3), member(4), member(5)]}
                maxWidth={200}
                testID="stack"
            />,
        );
        expect(queryByTestId('stack-overflow')).toBeNull();
    });
});
