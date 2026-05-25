/**
 * ActivityItemSkeleton — placeholder matching activity feed card layout.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FeedChatRow } from './FeedChatRow';
import { colors } from '../theme';

export function ActivityItemSkeleton() {
    const avatarPlaceholder = (
        <View style={styles.avatar} testID="activity-skeleton-avatar" />
    );

    return (
        <FeedChatRow avatar={avatarPlaceholder}>
            <View style={styles.card} testID="activity-item-skeleton">
                <View style={styles.icon} />
                <View className="flex-1 gap-2">
                    <View className="h-4 rounded bg-gray-200" style={{ width: '78%' }} />
                    <View className="h-3 rounded bg-gray-100" style={{ width: '42%' }} />
                    <View className="h-3 rounded bg-gray-100" style={{ width: '55%' }} />
                </View>
                <View className="h-4 w-16 rounded bg-gray-200" />
            </View>
        </FeedChatRow>
    );
}

const styles = StyleSheet.create({
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.gray200,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.gray100,
        backgroundColor: colors.white,
        paddingHorizontal: 14,
        paddingVertical: 12,
        width: '100%',
    },
    icon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: colors.gray100,
        flexShrink: 0,
    },
});
