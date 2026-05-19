/**
 * FiltersSheet — bottom-sheet modal with filter sections for the groups list.
 * Built on React Native's Modal (no @gorhom/bottom-sheet dependency).
 * `Apply` is the only commit boundary — local state is reset on close.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupType } from '@cost-share/shared';

export type BalanceState = 'all' | 'owe' | 'owed' | 'settled';

export interface Filters {
    balanceState: BalanceState;
    types: GroupType[];
    includeArchived: boolean;
    currencies: string[];
}

export const DEFAULT_FILTERS: Filters = {
    balanceState: 'all',
    types: [],
    includeArchived: false,
    currencies: [],
};

export function isAnyFilterActive(f: Filters): boolean {
    return (
        f.balanceState !== 'all' ||
        f.types.length > 0 ||
        f.includeArchived ||
        f.currencies.length > 0
    );
}

interface FiltersSheetProps {
    visible: boolean;
    filters: Filters;
    availableTypes: GroupType[];
    availableCurrencies: string[];
    onApply: (next: Filters) => void;
    onClose: () => void;
}

function Chip({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={
                active
                    ? 'px-3 py-1.5 rounded-full bg-primary mr-2 mb-2'
                    : 'px-3 py-1.5 rounded-full bg-gray-100 mr-2 mb-2'
            }
        >
            <Text
                className={
                    active
                        ? 'text-sm font-medium text-white'
                        : 'text-sm font-medium text-gray-700'
                }
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

export function FiltersSheet({
    visible,
    filters,
    availableTypes,
    availableCurrencies,
    onApply,
    onClose,
}: FiltersSheetProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<Filters>(filters);

    useEffect(() => {
        if (visible) setDraft(filters);
    }, [visible, filters]);

    const balanceOptions: { key: BalanceState; label: string }[] = [
        { key: 'all', label: t('groups.filters.balance.all') },
        { key: 'owe', label: t('groups.filters.balance.owe') },
        { key: 'owed', label: t('groups.filters.balance.owed') },
        { key: 'settled', label: t('groups.filters.balance.settled') },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                onPress={onClose}
                className="flex-1 bg-black/40 justify-end"
            >
                <Pressable
                    onPress={() => {}}
                    className="bg-white rounded-t-3xl"
                >
                    <View className="px-5 pt-3 pb-2">
                        <View className="self-center w-10 h-1 rounded-full bg-gray-300 mb-3" />
                        <Text className="text-lg font-semibold text-gray-900">
                            {t('groups.filters.title')}
                        </Text>
                    </View>

                    <ScrollView
                        className="px-5"
                        contentContainerClassName="pb-2"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text className="text-xs font-semibold uppercase text-gray-500 mt-3 mb-2">
                            {t('groups.filters.balance.label')}
                        </Text>
                        <View className="flex-row flex-wrap">
                            {balanceOptions.map(opt => (
                                <Chip
                                    key={opt.key}
                                    label={opt.label}
                                    active={draft.balanceState === opt.key}
                                    onPress={() =>
                                        setDraft(d => ({ ...d, balanceState: opt.key }))
                                    }
                                />
                            ))}
                        </View>

                        {availableTypes.length > 0 && (
                            <>
                                <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                                    {t('groups.filters.type.label')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    {availableTypes.map(type => (
                                        <Chip
                                            key={type}
                                            label={t(`groups.types.${type}`, { defaultValue: type })}
                                            active={draft.types.includes(type)}
                                            onPress={() =>
                                                setDraft(d => ({
                                                    ...d,
                                                    types: toggle(d.types, type),
                                                }))
                                            }
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        {availableCurrencies.length > 0 && (
                            <>
                                <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                                    {t('groups.filters.currency.label')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    {availableCurrencies.map(c => (
                                        <Chip
                                            key={c}
                                            label={c}
                                            active={draft.currencies.includes(c)}
                                            onPress={() =>
                                                setDraft(d => ({
                                                    ...d,
                                                    currencies: toggle(d.currencies, c),
                                                }))
                                            }
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        <View className="flex-row items-center justify-between mt-5 mb-1">
                            <Text className="text-sm font-medium text-gray-700">
                                {t('groups.filters.status.includeArchived')}
                            </Text>
                            <Switch
                                value={draft.includeArchived}
                                onValueChange={v =>
                                    setDraft(d => ({ ...d, includeArchived: v }))
                                }
                            />
                        </View>
                    </ScrollView>

                    <View className="flex-row px-5 pt-3 pb-6 border-t border-gray-100">
                        <TouchableOpacity
                            onPress={() => setDraft(DEFAULT_FILTERS)}
                            className="flex-1 mr-2 h-11 rounded-xl bg-gray-100 items-center justify-center"
                        >
                            <Text className="text-sm font-medium text-gray-700">
                                {t('groups.filters.clearAll')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                onApply(draft);
                                onClose();
                            }}
                            className="flex-1 ml-2 h-11 rounded-xl bg-primary items-center justify-center"
                        >
                            <Text className="text-sm font-semibold text-white">
                                {t('groups.filters.apply')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
