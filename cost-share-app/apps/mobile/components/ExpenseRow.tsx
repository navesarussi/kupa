/**
 * ExpenseRow — feed row for an expense.
 * Date stack · receipt/category thumb · description + sub-line · delta on the trailing edge.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ExpenseWithDelta } from '@cost-share/shared';
import { AppIcon, AppIconName } from './AppIcon';
import { HighlightedText } from './HighlightedText';
import { colors } from '../theme';

interface ExpenseRowProps {
    expense: ExpenseWithDelta;
    payerName: string;
    onPress: (id: string) => void;
    searchQuery?: string;
}

const categoryIcon: Record<string, AppIconName> = {
    food: 'restaurant-outline',
    transport: 'car-outline',
    accommodation: 'bed-outline',
    utilities: 'flash-outline',
    entertainment: 'film-outline',
    shopping: 'bag-outline',
    healthcare: 'medkit-outline',
    other: 'receipt-outline',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function ExpenseRowBase({ expense, payerName, onPress, searchQuery }: ExpenseRowProps) {
    const { t } = useTranslation();
    const date = new Date(expense.expenseDate);
    const month = MONTHS[date.getMonth()];
    const day = date.getDate();

    const deltaText = Math.abs(expense.myDelta).toFixed(2);
    const isLent = expense.myDeltaState === 'lent';
    const isBorrowed = expense.myDeltaState === 'borrowed';
    const amountColor = isLent
        ? 'text-green-600'
        : isBorrowed
            ? 'text-red-500'
            : 'text-gray-400';
    const labelKey = isLent
        ? 'groups.expense.youLent'
        : isBorrowed
            ? 'groups.expense.youBorrowed'
            : 'groups.expense.settled';

    return (
        <TouchableOpacity
            onPress={() => onPress(expense.id)}
            activeOpacity={0.7}
            className="bg-white rounded-2xl p-3 mb-2 border border-gray-100 flex-row items-center"
        >
            <View style={{ width: 44 }} className="items-center mr-2">
                <Text className="text-[10px] font-semibold text-gray-500">{month}</Text>
                <Text className="text-lg font-bold text-gray-900 leading-5">{day}</Text>
            </View>

            <View
                style={{ width: 40, height: 40 }}
                className="rounded-xl bg-primary-extra-light items-center justify-center overflow-hidden mr-3"
            >
                {expense.receiptUrl ? (
                    <Image
                        source={{ uri: expense.receiptUrl }}
                        style={{ width: 40, height: 40 }}
                        resizeMode="cover"
                    />
                ) : (
                    <AppIcon
                        name={categoryIcon[expense.category ?? 'other'] ?? 'receipt-outline'}
                        size={20}
                        color={colors.primary}
                    />
                )}
            </View>

            <View className="flex-1 mr-2">
                <HighlightedText
                    className="text-base font-semibold text-gray-900"
                    text={expense.description}
                    query={searchQuery}
                    numberOfLines={1}
                />
                <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                    {t('expenses.paidBySub', {
                        amount: `${expense.currency} ${expense.amount.toFixed(2)}`,
                        name: payerName,
                    })}
                </Text>
            </View>

            <View className="items-end">
                <Text
                    className={`text-sm font-semibold ${amountColor}`}
                    numberOfLines={1}
                >
                    {`${expense.currency} ${deltaText}`}
                </Text>
                <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                    {t(labelKey, { amount: `${expense.currency} ${deltaText}` })}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

export const ExpenseRow = React.memo(ExpenseRowBase);
