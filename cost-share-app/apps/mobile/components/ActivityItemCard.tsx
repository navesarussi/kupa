/**
 * ActivityItemCard — group-feed-style card with per-type visual variants.
 * Type is conveyed by the leading icon only (no badge/tag).
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import type { TFunction } from 'i18next';
import { RecentActivity } from '@cost-share/shared';
import { Text } from './AppText';
import { FeedRowThumbnail } from './FeedRowThumbnail';
import { formatCurrencyAmount } from '../lib/currencyDisplay';
import {
    activityCardAmountClass,
    getActivityCardVariant,
} from '../lib/activityCardVariant';
import { useRtlLayout, rtlRowStyle } from '../hooks/useRtlLayout';

export function resolveActivityTitle(
    activity: RecentActivity,
    groupName: string | undefined,
    t: TFunction,
): string {
    const name = activity.userName;
    const group = groupName ?? '';

    switch (activity.activityType) {
        case 'friend_request':
            if (activity.friendRequestStatus === 'accepted') {
                return t('activity.notifications.friendRequestAccepted', { name });
            }
            if (activity.friendRequestStatus === 'rejected') {
                return t('activity.notifications.friendRequestRejected', { name });
            }
            return t('activity.notifications.friendRequest', { name });
        case 'group_invite':
            return t('activity.notifications.groupInvite', { name, group });
        case 'member_joined':
            return t('activity.notifications.memberJoined', { name, group });
        case 'member_left':
            return t('activity.notifications.memberLeft', { name, group });
        case 'expense':
            return activity.description;
        case 'settlement':
            return activity.description;
        case 'message':
            return activity.description;
        default:
            return activity.description;
    }
}

interface ActivityItemCardProps {
    activity: RecentActivity;
    title: string;
    meta: string;
    groupName?: string;
    onPress?: () => void;
    testID?: string;
}

export function ActivityItemCard({
    activity,
    title,
    meta,
    groupName,
    onPress,
    testID,
}: ActivityItemCardProps) {
    const isRtl = useRtlLayout();
    const variant = getActivityCardVariant(
        activity.activityType,
        activity.friendRequestStatus,
    );
    const showAmount =
        variant.showAmount && activity.amount > 0 && Boolean(activity.currency);
    const amountText = showAmount
        ? formatCurrencyAmount(activity.amount, activity.currency)
        : null;

    const rowStyle = {
        gap: 12,
        alignItems: 'center' as const,
        ...rtlRowStyle(isRtl),
    };

    const shellStyle = {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        width: '100%' as const,
        backgroundColor: variant.backgroundColor,
        borderColor: variant.borderColor,
    };

    const body = (
        <View style={rowStyle}>
            <FeedRowThumbnail
                iconName={variant.iconName}
                iconColor={variant.iconColor}
                iconBgColor={variant.iconBgColor}
                testID="activity-card-thumbnail"
            />
            <View className="flex-1 min-w-0" style={{ gap: 3 }}>
                <Text
                    className="text-[15px] font-semibold text-gray-900 leading-5"
                    numberOfLines={variant.titleLines}
                >
                    {title}
                </Text>
                {groupName && variant.showGroupLine ? (
                    <Text
                        className="text-[12px] font-medium text-primary leading-4"
                        numberOfLines={1}
                    >
                        {groupName}
                    </Text>
                ) : null}
                <Text
                    className="text-[11px] text-gray-400 leading-4"
                    numberOfLines={1}
                >
                    {meta}
                </Text>
            </View>
            {amountText ? (
                <View
                    testID="activity-card-amount"
                    style={{ flexShrink: 0, maxWidth: 108, alignItems: 'flex-end' }}
                >
                    <Text
                        className={`text-[15px] font-bold ${activityCardAmountClass(variant.amountTone)}`}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        style={{ textAlign: 'right' }}
                    >
                        {amountText}
                    </Text>
                </View>
            ) : null}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                testID={testID}
                style={shellStyle}
            >
                {body}
            </TouchableOpacity>
        );
    }

    return (
        <View testID={testID} style={shellStyle}>
            {body}
        </View>
    );
}
