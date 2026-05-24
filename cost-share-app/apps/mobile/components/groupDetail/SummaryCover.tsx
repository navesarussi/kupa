/**
 * SummaryCover — top region of GroupSummaryCard.
 * Image background OR type gradient + icon, with scrim, type chip,
 * title block, and member stack overlaid.
 */

import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Group, GroupMemberLite } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { MemberStack } from './MemberStack';
import { getGroupTypeVisual } from '../../lib/groupTypeVisuals';

const COVER_HEIGHT = 150;

interface SummaryCoverProps {
    group: Group;
    members: GroupMemberLite[];
}

export function SummaryCover({ group, members }: SummaryCoverProps) {
    const { t } = useTranslation();
    const visual = getGroupTypeVisual(group.groupType);
    const typeLabel = t(`groups.types.${group.groupType}`, {
        defaultValue: group.groupType,
    });

    const overlay = (
        <>
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
                locations={[0.35, 1]}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.typeChip}>
                <AppIcon name={visual.icon} size={12} color="#fff" />
                <Text className="text-[11px] font-semibold text-white">
                    {typeLabel}
                </Text>
            </View>

            <View style={styles.titleRow}>
                <View style={styles.titleColumn}>
                    <Text
                        numberOfLines={1}
                        className="text-[18px] font-bold text-white"
                        style={styles.titleShadow}
                    >
                        {group.name}
                    </Text>
                    <Text
                        numberOfLines={1}
                        className="text-[11px] text-white/90"
                        style={[styles.subtitleShadow, { marginTop: 2 }]}
                    >
                        {t('groups.memberCount', { count: members.length })}
                    </Text>
                </View>
                <MemberStack members={members} />
            </View>
        </>
    );

    if (group.imageUrl) {
        return (
            <ImageBackground
                source={{ uri: group.imageUrl }}
                resizeMode="cover"
                style={styles.cover}
                testID="summary-cover-image"
            >
                {overlay}
            </ImageBackground>
        );
    }

    return (
        <LinearGradient
            colors={visual.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}
            testID="summary-cover-gradient"
        >
            <View style={styles.centeredIcon}>
                <AppIcon
                    name={visual.icon}
                    size={72}
                    color="rgba(255,255,255,0.45)"
                />
            </View>
            {overlay}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    cover: { width: '100%', height: COVER_HEIGHT },
    centeredIcon: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeChip: {
        position: 'absolute',
        top: 10,
        left: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 9999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    titleRow: {
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 10,
    },
    titleColumn: { flex: 1, minWidth: 0 },
    titleShadow: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    subtitleShadow: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
