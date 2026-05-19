/**
 * Activity feed — Supabase direct (expenses + settlements for user's groups)
 */

import { RecentActivity } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';

async function getUserGroupIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('is_active', true);
    if (error) throw error;
    return (data ?? []).map(row => row.group_id as string);
}

async function fetchProfileNames(userIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (userIds.length === 0) return names;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
    if (error) throw error;

    for (const row of data ?? []) {
        names.set(row.id as string, row.name as string);
    }
    return names;
}

export async function fetchRecentActivity(): Promise<RecentActivity[]> {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
        const groupIds = await getUserGroupIds(userId);
        if (groupIds.length === 0) return [];

        const [expensesResult, settlementsResult] = await Promise.all([
            supabase
                .from('expenses')
                .select(
                    'id, group_id, description, amount, currency, expense_date, created_at, created_by',
                )
                .in('group_id', groupIds)
                .eq('is_deleted', false),
            supabase
                .from('settlements')
                .select(
                    'id, group_id, amount, currency, settlement_date, created_at, from_user_id, to_user_id',
                )
                .in('group_id', groupIds),
        ]);

        if (expensesResult.error) throw expensesResult.error;
        if (settlementsResult.error) throw settlementsResult.error;

        const userIds = new Set<string>();
        for (const row of expensesResult.data ?? []) {
            userIds.add(row.created_by as string);
        }
        for (const row of settlementsResult.data ?? []) {
            userIds.add(row.from_user_id as string);
            userIds.add(row.to_user_id as string);
        }

        const namesById = await fetchProfileNames([...userIds]);
        const activities: RecentActivity[] = [];

        for (const row of expensesResult.data ?? []) {
            const createdBy = row.created_by as string;
            activities.push({
                id: row.id as string,
                activityType: 'expense',
                groupId: row.group_id as string,
                description: row.description as string,
                amount: Number(row.amount),
                currency: row.currency as string,
                userId: createdBy,
                userName: namesById.get(createdBy) ?? 'Unknown',
                activityDate: new Date(row.expense_date as string),
                createdAt: new Date(row.created_at as string),
            });
        }

        for (const row of settlementsResult.data ?? []) {
            const fromUserId = row.from_user_id as string;
            const toUserId = row.to_user_id as string;
            const fromName = namesById.get(fromUserId) ?? 'Unknown';
            const toName = namesById.get(toUserId) ?? 'Unknown';
            activities.push({
                id: row.id as string,
                activityType: 'settlement',
                groupId: row.group_id as string,
                description: `${fromName} paid ${toName}`,
                amount: Number(row.amount),
                currency: row.currency as string,
                userId: fromUserId,
                userName: fromName,
                activityDate: new Date(row.settlement_date as string),
                createdAt: new Date(row.created_at as string),
            });
        }

        return activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error('Failed to fetch activity:', error);
        return [];
    }
}
