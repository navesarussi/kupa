/**
 * MemberStack — overlapping member avatars for the group summary cover.
 * Shows every member; shrinks avatars when the row would overflow.
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { MemberAvatar } from '../MemberAvatar';
import { GroupMemberLite } from '@cost-share/shared';

interface MemberStackProps {
    members: GroupMemberLite[];
    /** Max width for the avatar row (defaults from screen width). */
    maxWidth?: number;
    testID?: string;
}

const MAX_AVATAR_PX = 32;
const MIN_AVATAR_PX = 14;
const OVERLAP_RATIO = 0.28;

/** Width of n overlapping circles at a given pixel size. */
export function memberStackRowWidth(count: number, size: number): number {
    if (count <= 0) return 0;
    const overlap = Math.round(size * OVERLAP_RATIO);
    const step = size - overlap;
    return size + (count - 1) * step;
}

/** Pick avatar size so all members fit within maxWidth on one row. */
export function getMemberStackLayout(
    count: number,
    maxWidth: number,
): { size: number; overlap: number } {
    if (count <= 0) {
        return { size: MAX_AVATAR_PX, overlap: Math.round(MAX_AVATAR_PX * OVERLAP_RATIO) };
    }
    for (let size = MAX_AVATAR_PX; size >= MIN_AVATAR_PX; size -= 1) {
        const overlap = Math.round(size * OVERLAP_RATIO);
        if (memberStackRowWidth(count, size) <= maxWidth) {
            return { size, overlap };
        }
    }
    const size = MIN_AVATAR_PX;
    return { size, overlap: Math.round(size * OVERLAP_RATIO) };
}

export function MemberStack({ members, maxWidth: maxWidthProp, testID }: MemberStackProps) {
    const { width: screenWidth } = useWindowDimensions();
    const maxWidth = maxWidthProp ?? Math.max(120, Math.floor(screenWidth * 0.48));

    const { size, overlap } = useMemo(
        () => getMemberStackLayout(members.length, maxWidth),
        [members.length, maxWidth],
    );

    if (members.length === 0) return null;

    return (
        <View
            style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth }}
            testID={testID}
        >
            {members.map((m, i) => (
                <View
                    key={m.userId}
                    style={{
                        marginLeft: i === 0 ? 0 : -overlap,
                        borderRadius: 9999,
                        borderWidth: size >= 24 ? 2 : 1,
                        borderColor: '#fff',
                    }}
                >
                    <MemberAvatar
                        name={m.displayName}
                        avatarUrl={m.avatarUrl}
                        size="xs"
                        pixelSize={size}
                    />
                </View>
            ))}
        </View>
    );
}
