/**
 * ExpenseFiltersSheet — bottom-sheet modal: categories / members / date range.
 * Apply is the only commit boundary (local draft state).
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ExpenseCategory, GroupMemberLite } from '@cost-share/shared';

export interface ExpenseFilters {
    categories: ExpenseCategory[];
    memberIds: string[];
    dateFrom?: string;
    dateTo?: string;
}

export const DEFAULT_EXPENSE_FILTERS: ExpenseFilters = {
    categories: [],
    memberIds: [],
};

export function isAnyExpenseFilterActive(f: ExpenseFilters): boolean {
    return (
        f.categories.length > 0 ||
        f.memberIds.length > 0 ||
        Boolean(f.dateFrom) ||
        Boolean(f.dateTo)
    );
}

interface ExpenseFiltersSheetProps {
    visible: boolean;
    filters: ExpenseFilters;
    availableCategories: ExpenseCategory[];
    availableMembers: GroupMemberLite[];
    onApply: (next: ExpenseFilters) => void;
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

export function ExpenseFiltersSheet({
    visible,
    filters,
    availableCategories,
    availableMembers,
    onApply,
    onClose,
}: ExpenseFiltersSheetProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ExpenseFilters>(filters);

    useEffect(() => {
        if (visible) setDraft(filters);
    }, [visible, filters]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
                <Pressable onPress={() => {}} className="bg-white rounded-t-3xl">
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
                        {availableCategories.length > 0 && (
                            <>
                                <Text className="text-xs font-semibold uppercase text-gray-500 mt-3 mb-2">
                                    {t('groups.filters.category.label')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    {availableCategories.map(c => (
                                        <Chip
                                            key={c}
                                            label={t(`expenses.categories.${c}`, { defaultValue: c })}
                                            active={draft.categories.includes(c)}
                                            onPress={() =>
                                                setDraft(d => ({
                                                    ...d,
                                                    categories: toggle(d.categories, c),
                                                }))
                                            }
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        {availableMembers.length > 0 && (
                            <>
                                <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                                    {t('groups.filters.member.label')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    {availableMembers.map(m => (
                                        <Chip
                                            key={m.userId}
                                            label={m.displayName}
                                            active={draft.memberIds.includes(m.userId)}
                                            onPress={() =>
                                                setDraft(d => ({
                                                    ...d,
                                                    memberIds: toggle(d.memberIds, m.userId),
                                                }))
                                            }
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        <Text className="text-xs font-semibold uppercase text-gray-500 mt-4 mb-2">
                            {t('groups.filters.dateRange.label')}
                        </Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">
                                    {t('groups.filters.dateRange.from')}
                                </Text>
                                <TextInput
                                    value={draft.dateFrom ?? ''}
                                    onChangeText={v =>
                                        setDraft(d => ({ ...d, dateFrom: v || undefined }))
                                    }
                                    placeholder="YYYY-MM-DD"
                                    autoCapitalize="none"
                                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                                    className="h-10 rounded-xl bg-gray-100 px-3 text-sm text-gray-900"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">
                                    {t('groups.filters.dateRange.to')}
                                </Text>
                                <TextInput
                                    value={draft.dateTo ?? ''}
                                    onChangeText={v =>
                                        setDraft(d => ({ ...d, dateTo: v || undefined }))
                                    }
                                    placeholder="YYYY-MM-DD"
                                    autoCapitalize="none"
                                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                                    className="h-10 rounded-xl bg-gray-100 px-3 text-sm text-gray-900"
                                />
                            </View>
                        </View>
                    </ScrollView>

                    <View className="flex-row px-5 pt-3 pb-6 border-t border-gray-100">
                        <TouchableOpacity
                            onPress={() => setDraft(DEFAULT_EXPENSE_FILTERS)}
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
