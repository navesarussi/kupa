/**
 * ActivityFeedScreen
 * Cross-group activity feed (Supabase) — REQ-ACT-01
 */

import { Text } from '../../components/AppText';
import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { RecentActivity } from '@cost-share/shared';
import { useActivityQuery } from '../../hooks/queries/useActivityQuery';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { ActivityItem } from '../../components/ActivityItem';
import { AppIcon } from '../../components/AppIcon';
import { SearchExpandable } from '../../components/SearchExpandable';
import {
    ActivityFiltersSheet,
    DEFAULT_ACTIVITY_FILTERS,
    isAnyActivityFilterActive,
    type ActivityFilters,
} from '../../components/ActivityFiltersSheet';
import {
    filterAndSortActivities,
    matchesActivitySearch,
} from '../../lib/activityFilters';
import { useAppStore } from '../../store';
import { APP_BRAND_TITLE, colors } from '../../theme';

function unique<T>(values: T[]): T[] {
    return Array.from(new Set(values));
}

export function ActivityFeedScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const currentUser = useAppStore((s) => s.currentUser);
    const groups = useAppStore((s) => s.groups);

    const {
        data,
        isLoading,
        isRefetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        refetch,
    } = useActivityQuery();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_ACTIVITY_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const activities = useMemo(
        () => data?.pages.flatMap((page) => page.items) ?? [],
        [data],
    );

    const handleRefresh = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    const availableCurrencies = useMemo(
        () => unique(activities.map((a) => a.currency)).sort(),
        [activities],
    );

    const availableGroups = useMemo(() => {
        const ids = unique(activities.map((a) => a.groupId));
        const nameById = new Map(groups.map((g) => [g.id, g.name]));
        return ids
            .map((id) => ({ id, name: nameById.get(id) ?? id }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [activities, groups]);

    const displayedActivities = useMemo(() => {
        const filtered = filterAndSortActivities(
            activities,
            filters,
            currentUser?.id,
        );
        return filtered.filter((item) => matchesActivitySearch(item, searchQuery));
    }, [activities, filters, searchQuery, currentUser?.id]);

    const filterActive = isAnyActivityFilterActive(filters);

    const handleActivityPress = useCallback(
        (activity: RecentActivity) => {
            if (activity.activityType === 'expense') {
                navigation.navigate('Groups', {
                    screen: 'ExpenseDetail',
                    params: { expenseId: activity.id, groupId: activity.groupId },
                });
                return;
            }
            if (
                activity.activityType === 'message' ||
                activity.activityType === 'settlement'
            ) {
                navigation.navigate('Groups', {
                    screen: 'GroupDetail',
                    params: { groupId: activity.groupId },
                });
            }
        },
        [navigation],
    );

    const renderActivity = ({ item }: { item: RecentActivity }) => (
        <ActivityItem activity={item} onPress={handleActivityPress} />
    );

    if (isLoading && activities.length === 0) {
        return <LoadingIndicator />;
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <View className="px-4 pt-2 pb-1">
                <Text
                    className="text-2xl font-bold text-gray-900 text-center"
                    accessibilityRole="header"
                >
                    {APP_BRAND_TITLE}
                </Text>
            </View>

            <View className="flex-row items-center px-4 py-2">
                <SearchExpandable
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    expanded={searchExpanded}
                    onExpandedChange={setSearchExpanded}
                    placeholder={t('activity.searchPlaceholder')}
                    testID="activity-search"
                />
                {!searchExpanded && (
                    <TouchableOpacity
                        onPress={() => setFiltersOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('activity.filters.title')}
                        className="ml-1 h-9 w-9 items-center justify-center relative"
                        testID="activity-filter-btn"
                    >
                        <AppIcon
                            name="options-outline"
                            size={22}
                            color={colors.gray500}
                        />
                        {filterActive && (
                            <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={displayedActivities}
                keyExtractor={(item) => `${item.activityType}-${item.id}`}
                renderItem={renderActivity}
                contentContainerClassName="px-4 pb-4"
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <ActivityIndicator className="py-4" color={colors.primary} />
                    ) : null
                }
                ListEmptyComponent={
                    <EmptyState
                        iconName="list-outline"
                        title={t('activity.noActivity')}
                        message={t('activity.noActivityMessage')}
                    />
                }
            />

            <ActivityFiltersSheet
                visible={filtersOpen}
                filters={filters}
                availableCurrencies={availableCurrencies}
                availableGroups={availableGroups}
                onApply={setFilters}
                onClose={() => setFiltersOpen(false)}
            />
        </SafeAreaView>
    );
}
