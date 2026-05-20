import React, { useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { useInviteLink } from '../hooks/useInviteLink';
import { useRtlLayout, rtlRowStyle } from '../hooks/useRtlLayout';
import { colors } from '../theme';

interface Props {
    kind: 'friend' | 'group';
    mode: 'expanded' | 'compact';
    groupId?: string;
}

function trimUrl(url: string): string {
    // strip the protocol for a tighter display
    return url.replace(/^https?:\/\//, '');
}

export function InviteLinkBlock({ kind, mode, groupId }: Props) {
    const { t } = useTranslation();
    const { url, isReady, share, rotate } = useInviteLink(groupId);
    const isRtl = useRtlLayout();

    const labelKey = kind === 'friend' ? 'invite.friend.linkLabel' : 'invite.group.linkLabel';
    const rotateKey = kind === 'friend' ? 'invite.friend.rotate' : 'invite.group.rotate';
    const shareKey = kind === 'friend' ? 'invite.friend.cta' : 'invite.group.title';
    const copiedKey = 'invite.friend.copied'; // shared copy for both kinds

    const handleCopy = useCallback(async () => {
        if (!url) return;
        await Clipboard.setStringAsync(url);
        Toast.show({ type: 'success', text1: t(copiedKey) });
    }, [url, t]);

    if (!isReady) return null;

    return (
        <View className="bg-white rounded-xl border border-slate-200/80 p-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {t(labelKey)}
            </Text>

            {/* URL + Copy */}
            <View style={rtlRowStyle(isRtl)} className="items-center mb-3">
                <Text className="flex-1 text-sm text-gray-800" numberOfLines={1}>
                    {trimUrl(url)}
                </Text>
                <TouchableOpacity
                    onPress={handleCopy}
                    className="ml-2"
                    testID="invite-link-copy"
                >
                    <Text className="text-sm font-semibold text-primary">
                        {t('invite.friend.copyButton')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Share */}
            <TouchableOpacity
                onPress={share}
                style={rtlRowStyle(isRtl)}
                className="items-center py-3 border-t border-slate-100"
                testID="invite-link-share"
            >
                <AppIcon name="share-outline" size={20} color={colors.primary} />
                <Text className="flex-1 ml-3 text-sm font-semibold text-gray-800">
                    {t(shareKey)}
                </Text>
                <AppIcon
                    name={isRtl ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color={colors.gray400}
                />
            </TouchableOpacity>

            {/* Rotate (expanded only) */}
            {mode === 'expanded' && (
                <TouchableOpacity
                    onPress={rotate}
                    style={rtlRowStyle(isRtl)}
                    className="items-center py-3 border-t border-slate-100"
                    testID="invite-link-rotate"
                >
                    <AppIcon name="refresh-outline" size={20} color={colors.gray600} />
                    <Text className="flex-1 ml-3 text-sm font-medium text-gray-700">
                        {t(rotateKey)}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
