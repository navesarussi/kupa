/**
 * MessageRow — feed row for a group message (avatar + bubble + footer).
 * Long-press on own messages opens an action sheet for Edit/Delete.
 */

import React, { useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActionSheetIOS,
    Alert,
    Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupMessage } from '@cost-share/shared';
import { MemberAvatar } from './MemberAvatar';
import { HighlightedText } from './HighlightedText';
import { AppIcon } from './AppIcon';
import { colors } from '../theme';

interface MessageRowProps {
    message: GroupMessage;
    senderName: string;
    senderAvatarUrl?: string;
    isMine: boolean;
    onEdit: (m: GroupMessage) => void;
    onDelete: (m: GroupMessage) => void;
    searchQuery?: string;
}

function relativeTime(date: Date, now: Date = new Date()): string {
    const diffMs = now.getTime() - date.getTime();
    const sec = Math.max(0, Math.round(diffMs / 1000));
    if (sec < 60) return 'now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day}d`;
    const weeks = Math.round(day / 7);
    if (weeks < 5) return `${weeks}w`;
    return date.toLocaleDateString();
}

function MessageRowBase({
    message,
    senderName,
    senderAvatarUrl,
    isMine,
    onEdit,
    onDelete,
    searchQuery,
}: MessageRowProps) {
    const { t } = useTranslation();

    const handleLongPress = useCallback(() => {
        if (!isMine) return;
        const options = [
            t('groups.message.edit'),
            t('groups.message.delete'),
            t('common.cancel'),
        ];
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    destructiveButtonIndex: 1,
                    cancelButtonIndex: 2,
                },
                buttonIndex => {
                    if (buttonIndex === 0) onEdit(message);
                    if (buttonIndex === 1) onDelete(message);
                },
            );
        } else {
            Alert.alert(senderName, message.body, [
                { text: t('groups.message.edit'), onPress: () => onEdit(message) },
                {
                    text: t('groups.message.delete'),
                    style: 'destructive',
                    onPress: () => onDelete(message),
                },
                { text: t('common.cancel'), style: 'cancel' },
            ]);
        }
    }, [isMine, message, onEdit, onDelete, senderName, t]);

    return (
        <TouchableOpacity
            onLongPress={handleLongPress}
            activeOpacity={isMine ? 0.7 : 1}
            disabled={!isMine}
            className="flex-row items-start mb-2"
        >
            <View className="mr-2 mt-3">
                <MemberAvatar name={senderName} avatarUrl={senderAvatarUrl} size="sm" />
            </View>
            <View className="flex-1 bg-white rounded-2xl p-3 border border-gray-100">
                <View className="flex-row items-start">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-medium text-gray-600">
                            {senderName}
                        </Text>
                        <HighlightedText
                            className="text-sm text-gray-900 mt-0.5"
                            text={message.body}
                            query={searchQuery}
                        />
                    </View>
                    {isMine && (
                        <TouchableOpacity
                            onPress={() => onDelete(message)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={t('groups.message.delete')}
                            testID="message-delete-btn"
                        >
                            <AppIcon
                                name="trash-outline"
                                size={16}
                                color={colors.gray400}
                            />
                        </TouchableOpacity>
                    )}
                </View>
                <View className="flex-row items-center mt-1.5">
                    <Text className="text-[10px] text-gray-400">
                        {relativeTime(message.createdAt)}
                    </Text>
                    {message.editedAt && (
                        <Text
                            className="text-[10px] text-gray-400 ml-1"
                            testID="message-edited-tag"
                        >
                            · {t('groups.message.edited')}
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

export const MessageRow = React.memo(MessageRowBase);
