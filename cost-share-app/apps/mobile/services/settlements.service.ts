/**
 * Settlements Service — Supabase direct
 */

import { Settlement, CreateSettlementDto } from '@cost-share/shared';
import { settlementFromRow, validateSettlementAmount } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { getGroupBalances } from './groups.service';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';

export async function fetchSettlements(groupId?: string): Promise<Settlement[]> {
    try {
        let query = supabase
            .from('settlements')
            .select('*')
            .order('settlement_date', { ascending: false });
        if (groupId) {
            query = query.eq('group_id', groupId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map(settlementFromRow);
    } catch (error) {
        console.error('Failed to fetch settlements:', error);
        Toast.show({
            type: 'error',
            text1: 'Failed to load settlements',
            text2: i18n.t('common.networkError'),
        });
        return [];
    }
}

export async function getSettlementById(id: string): Promise<Settlement | null> {
    const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error || !data) return null;
    return settlementFromRow(data);
}

export async function createSettlement(dto: CreateSettlementDto): Promise<Settlement | null> {
    const createdBy = await getCurrentUserId();
    if (!createdBy) return null;

    const balances = await getGroupBalances(dto.groupId);
    const validation = validateSettlementAmount(
        balances,
        dto.fromUserId,
        dto.toUserId,
        dto.amount,
    );
    if (!validation.valid) {
        Toast.show({
            type: 'error',
            text1: 'Failed to record payment',
            text2: validation.message ?? i18n.t('common.networkError'),
        });
        return null;
    }

    const settlementDate = (dto.settlementDate ?? new Date()).toISOString().slice(0, 10);

    try {
        const { data, error } = await supabase
            .from('settlements')
            .insert({
                group_id: dto.groupId,
                from_user_id: dto.fromUserId,
                to_user_id: dto.toUserId,
                amount: dto.amount,
                currency: dto.currency,
                settlement_date: settlementDate,
                payment_method: dto.paymentMethod,
                created_by: createdBy,
            })
            .select()
            .single();
        if (error) throw error;

        Toast.show({
            type: 'success',
            text1: i18n.t('common.success'),
            text2: 'Payment recorded',
        });
        return settlementFromRow(data);
    } catch (error) {
        console.error('Failed to create settlement:', error);
        Toast.show({
            type: 'error',
            text1: 'Failed to record payment',
            text2: i18n.t('common.networkError'),
        });
        return null;
    }
}

export async function getUserSettlements(userId: string): Promise<Settlement[]> {
    const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('settlement_date', { ascending: false });
    if (error) {
        console.error('Failed to fetch user settlements:', error);
        return [];
    }
    return (data ?? []).map(settlementFromRow);
}

export async function getSettlementHistory(
    groupId: string,
    userId1: string,
    userId2: string,
): Promise<Settlement[]> {
    const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('group_id', groupId)
        .or(
            `and(from_user_id.eq.${userId1},to_user_id.eq.${userId2}),and(from_user_id.eq.${userId2},to_user_id.eq.${userId1})`,
        )
        .order('settlement_date', { ascending: false });
    if (error) {
        console.error('Failed to fetch settlement history:', error);
        return [];
    }
    return (data ?? []).map(settlementFromRow);
}
