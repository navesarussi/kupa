/**
 * FeedItemRow — switches between ExpenseRow and MessageRow based on item.kind.
 */

import React from 'react';
import { FeedItem, GroupMemberLite, GroupMessage } from '@cost-share/shared';
import { ExpenseRow } from './ExpenseRow';
import { MessageRow } from './MessageRow';

interface FeedItemRowProps {
    item: FeedItem;
    currentUserId: string;
    memberMap: Record<string, GroupMemberLite>;
    onExpensePress: (id: string) => void;
    onMessageEdit: (m: GroupMessage) => void;
    onMessageDelete: (m: GroupMessage) => void;
    searchQuery?: string;
}

export function FeedItemRow({
    item,
    currentUserId,
    memberMap,
    onExpensePress,
    onMessageEdit,
    onMessageDelete,
    searchQuery,
}: FeedItemRowProps) {
    if (item.kind === 'expense') {
        const payer = memberMap[item.expense.paidBy];
        return (
            <ExpenseRow
                expense={item.expense}
                payerName={payer?.displayName ?? ''}
                onPress={onExpensePress}
                searchQuery={searchQuery}
            />
        );
    }
    const sender = memberMap[item.message.userId];
    return (
        <MessageRow
            message={item.message}
            senderName={sender?.displayName ?? ''}
            senderAvatarUrl={sender?.avatarUrl}
            isMine={item.message.userId === currentUserId}
            onEdit={onMessageEdit}
            onDelete={onMessageDelete}
            searchQuery={searchQuery}
        />
    );
}
