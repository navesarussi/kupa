/**
 * CSV export for a group's expenses, shared via the OS share sheet.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
    Group,
    ExpenseWithSplits,
    GroupMemberLite,
} from '@cost-share/shared';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';

function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function buildCsv(
    group: Group,
    expenses: ExpenseWithSplits[],
    members: GroupMemberLite[],
): string {
    const nameById = new Map(members.map(m => [m.userId, m.displayName]));
    const header = ['Date', 'Description', 'Amount', 'Currency', 'Paid By', 'Splits'];
    const rows = expenses.map(e => {
        const date = new Date(e.expenseDate).toISOString().slice(0, 10);
        const payer = nameById.get(e.paidBy) ?? e.paidBy;
        const splits = e.splits
            .map(s => `${nameById.get(s.userId) ?? s.userId}=${s.amount.toFixed(2)}`)
            .join(';');
        return [
            date,
            e.description,
            e.amount.toFixed(2),
            e.currency,
            payer,
            splits,
        ].map(csvEscape).join(',');
    });
    return [header.join(','), ...rows].join('\n');
}

function safeName(name: string): string {
    return name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'group';
}

export async function exportGroupCsv(
    group: Group,
    expenses: ExpenseWithSplits[],
    members: GroupMemberLite[],
): Promise<boolean> {
    try {
        const csv = buildCsv(group, expenses, members);
        const filename = `${safeName(group.name)}-${todayIso()}.csv`;
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(csv);

        const available = await Sharing.isAvailableAsync();
        if (!available) {
            Toast.show({
                type: 'error',
                text1: i18n.t('groups.share.exportError'),
            });
            return false;
        }
        await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: i18n.t('groups.share.exportTitle'),
            UTI: 'public.comma-separated-values-text',
        });
        return true;
    } catch (error) {
        console.error('Failed to export CSV:', error);
        Toast.show({
            type: 'error',
            text1: i18n.t('groups.share.exportError'),
            text2: i18n.t('common.networkError'),
        });
        return false;
    }
}
