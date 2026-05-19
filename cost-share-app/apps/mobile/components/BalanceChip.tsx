/**
 * BalanceChip — small pill summarising a single group's net balance for the user.
 * Variants by sign: positive = owed (green), negative = owe (red), zero/undefined = settled (gray).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupBalance } from '@cost-share/shared';

interface BalanceChipProps {
    balance?: GroupBalance;
    defaultCurrency: string;
}

function formatAmount(amount: number, currency: string): string {
    return `${currency} ${Math.abs(amount).toFixed(2)}`;
}

export function BalanceChip({ balance, defaultCurrency }: BalanceChipProps) {
    const { t } = useTranslation();
    const net = balance?.net ?? 0;
    const currency = balance?.currency ?? defaultCurrency;

    if (!balance || Math.abs(net) < 0.01) {
        return (
            <View className="rounded-full bg-gray-100 px-2.5 py-1 max-w-[120px]">
                <Text
                    className="text-xs font-medium text-gray-500"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {t('groups.card.settled')}
                </Text>
            </View>
        );
    }

    const isOwed = net > 0;
    const containerClass = isOwed
        ? 'rounded-full bg-green-50 px-2.5 py-1 max-w-[120px]'
        : 'rounded-full bg-red-50 px-2.5 py-1 max-w-[120px]';
    const textClass = isOwed
        ? 'text-xs font-semibold text-green-600'
        : 'text-xs font-semibold text-red-500';
    const prefix = isOwed ? '+' : '−';

    return (
        <View className={containerClass}>
            <Text className={textClass} numberOfLines={1} ellipsizeMode="tail">
                {`${prefix}${formatAmount(net, currency)}`}
            </Text>
        </View>
    );
}
