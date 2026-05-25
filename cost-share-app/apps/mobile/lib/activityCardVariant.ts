/**
 * Per-type visual tokens for activity feed cards (icon-only type cue).
 * Each variant uses a white card with a subtle tinted border (like settlement).
 */

import type {
    ActivityType,
    FriendRequestActivityStatus,
} from '@cost-share/shared';
import type { AppIconName } from '../components/AppIcon';
import { colors } from '../theme';

export interface ActivityCardVariant {
    iconName: AppIconName;
    iconColor: string;
    iconBgColor: string;
    backgroundColor: string;
    borderColor: string;
    amountTone: 'default' | 'settlement' | 'muted';
    showAmount: boolean;
    showGroupLine: boolean;
    titleLines: number;
}

const EXPENSE: ActivityCardVariant = {
    iconName: 'receipt-outline',
    iconColor: colors.primaryDark,
    iconBgColor: colors.primaryExtraLight,
    backgroundColor: colors.white,
    borderColor: '#bfdbfe',
    amountTone: 'default',
    showAmount: true,
    showGroupLine: true,
    titleLines: 2,
};

const SETTLEMENT: ActivityCardVariant = {
    iconName: 'swap-horizontal-outline',
    iconColor: colors.success,
    iconBgColor: '#ecfdf5',
    backgroundColor: colors.white,
    borderColor: '#bbf7d0',
    amountTone: 'settlement',
    showAmount: true,
    showGroupLine: false,
    titleLines: 3,
};

const MESSAGE: ActivityCardVariant = {
    iconName: 'chatbubble-outline',
    iconColor: colors.primaryDark,
    iconBgColor: colors.primaryExtraLight,
    backgroundColor: colors.white,
    borderColor: '#c7d2fe',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: true,
    titleLines: 3,
};

const FRIEND_REQUEST: ActivityCardVariant = {
    iconName: 'person-add-outline',
    iconColor: '#b45309',
    iconBgColor: '#fffbeb',
    backgroundColor: colors.white,
    borderColor: '#fde68a',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: false,
    titleLines: 2,
};

const FRIEND_REQUEST_ACCEPTED: ActivityCardVariant = {
    iconName: 'checkmark-circle-outline',
    iconColor: colors.success,
    iconBgColor: '#ecfdf5',
    backgroundColor: colors.white,
    borderColor: '#bbf7d0',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: false,
    titleLines: 2,
};

const FRIEND_REQUEST_REJECTED: ActivityCardVariant = {
    iconName: 'close-circle-outline',
    iconColor: colors.gray500,
    iconBgColor: colors.gray100,
    backgroundColor: colors.white,
    borderColor: '#d1d5db',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: false,
    titleLines: 2,
};

const GROUP_INVITE: ActivityCardVariant = {
    iconName: 'people-outline',
    iconColor: colors.primaryDark,
    iconBgColor: colors.primaryExtraLight,
    backgroundColor: colors.white,
    borderColor: '#93c5fd',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: false,
    titleLines: 2,
};

const MEMBER_JOINED: ActivityCardVariant = {
    iconName: 'enter-outline',
    iconColor: colors.success,
    iconBgColor: '#ecfdf5',
    backgroundColor: colors.white,
    borderColor: '#bbf7d0',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: false,
    titleLines: 2,
};

const MEMBER_LEFT: ActivityCardVariant = {
    iconName: 'exit-outline',
    iconColor: colors.gray600,
    iconBgColor: colors.gray100,
    backgroundColor: colors.white,
    borderColor: '#d1d5db',
    amountTone: 'muted',
    showAmount: false,
    showGroupLine: false,
    titleLines: 2,
};

const VARIANTS: Record<ActivityType, ActivityCardVariant> = {
    expense: EXPENSE,
    settlement: SETTLEMENT,
    message: MESSAGE,
    friend_request: FRIEND_REQUEST,
    group_invite: GROUP_INVITE,
    member_joined: MEMBER_JOINED,
    member_left: MEMBER_LEFT,
};

export function getActivityCardVariant(
    type: ActivityType,
    friendRequestStatus?: FriendRequestActivityStatus,
): ActivityCardVariant {
    if (type === 'friend_request') {
        if (friendRequestStatus === 'accepted') return FRIEND_REQUEST_ACCEPTED;
        if (friendRequestStatus === 'rejected') return FRIEND_REQUEST_REJECTED;
        return FRIEND_REQUEST;
    }
    return VARIANTS[type] ?? EXPENSE;
}

export function activityCardAmountClass(tone: ActivityCardVariant['amountTone']): string {
    switch (tone) {
        case 'settlement':
            return 'text-green-600';
        case 'muted':
            return 'text-gray-500';
        default:
            return 'text-gray-900';
    }
}
