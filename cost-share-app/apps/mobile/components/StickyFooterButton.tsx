/**
 * StickyFooterButton — pinned full-width primary CTA above the bottom inset.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, AppIconName } from './AppIcon';

interface StickyFooterButtonProps {
    title: string;
    onPress: () => void;
    icon?: AppIconName;
    testID?: string;
}

export function StickyFooterButton({
    title,
    onPress,
    icon,
    testID,
}: StickyFooterButtonProps) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: insets.bottom + 12,
                paddingTop: 10,
                paddingHorizontal: 16,
            }}
            className="bg-white border-t border-gray-100"
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                className="h-14 rounded-2xl bg-primary items-center justify-center flex-row"
                testID={testID}
            >
                {icon ? <AppIcon name={icon} size={22} color="#fff" /> : null}
                <Text
                    className={`text-base font-semibold text-white${icon ? ' ml-2' : ''}`}
                >
                    {title}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
