/**
 * GroupDetailAppBar — flat white app bar above the GroupSummaryCard.
 * Back chevron, centered "Group" title, share + menu icons on the end.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';

interface GroupDetailAppBarProps {
    onBack: () => void;
    onShare: () => void;
    onMenu: () => void;
    title?: string;
}

export function GroupDetailAppBar({
    onBack,
    onShare,
    onMenu,
    title,
}: GroupDetailAppBarProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const isRtl = useRtlLayout();
    const resolvedTitle = title ?? t('groups.detail.title');

    return (
        <View
            style={{
                backgroundColor: '#fff',
                paddingTop: insets.top + 4,
                paddingBottom: 6,
                paddingHorizontal: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}
        >
            <TouchableOpacity
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="appbar-back"
                style={{ padding: 8 }}
            >
                <AppIcon
                    name={isRtl ? 'chevron-forward' : 'chevron-back'}
                    size={24}
                    color={colors.gray700}
                />
            </TouchableOpacity>

            <Text
                className="text-[14px] font-semibold"
                style={{ color: colors.gray500, flex: 1, textAlign: 'center' }}
                numberOfLines={1}
            >
                {resolvedTitle}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                    onPress={onShare}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="appbar-share"
                    style={{ padding: 8 }}
                >
                    <AppIcon
                        name="share-outline"
                        size={22}
                        color={colors.gray700}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onMenu}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="appbar-menu"
                    style={{ padding: 8 }}
                >
                    <AppIcon
                        name="ellipsis-vertical"
                        size={22}
                        color={colors.gray700}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}
