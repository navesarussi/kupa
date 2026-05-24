/**
 * GroupSummaryCard — composite hero card replacing GroupHero +
 * GroupBalanceBanner. Composes SummaryCover, SummaryBalanceStrip,
 * and SummaryFooter inside one rounded white frame.
 */

import React from 'react';
import { View } from 'react-native';
import { Group, GroupMemberLite } from '@cost-share/shared';
import { SummaryCover } from './SummaryCover';
import { SummaryBalanceStrip } from './SummaryBalanceStrip';
import { SummaryFooter } from './SummaryFooter';
import { colors, shadows } from '../../theme';

// Design token "border.card" (#E2E8F0 / slate-200) is not in theme/colors.ts.
const BORDER_CARD = '#E2E8F0';

export interface GroupSummaryBalance {
    net: number;
    currency: string;
    isSettled: boolean;
}

interface GroupSummaryCardProps {
    group: Group;
    members: GroupMemberLite[];
    balance: GroupSummaryBalance;
    settlementCount: number;
    noteHasContent: boolean;
    onOpenBalances: () => void;
    onOpenNote: () => void;
    onOpenSettleUp: () => void;
}

export function GroupSummaryCard({
    group,
    members,
    balance,
    settlementCount,
    noteHasContent,
    onOpenBalances,
    onOpenNote,
    onOpenSettleUp,
}: GroupSummaryCardProps) {
    return (
        <View
            style={{
                paddingHorizontal: 16,
                paddingTop: 6,
                paddingBottom: 12,
                backgroundColor: '#fff',
            }}
        >
            <View
                style={[
                    {
                        borderRadius: 20,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: BORDER_CARD,
                        backgroundColor: '#fff',
                    },
                    shadows.sm,
                ]}
            >
                <SummaryCover group={group} members={members} />
                <SummaryBalanceStrip
                    balance={balance}
                    onPress={onOpenBalances}
                    testID="summary-balance-strip"
                />
                <SummaryFooter
                    settlementCount={settlementCount}
                    isSettled={balance.isSettled}
                    noteHasContent={noteHasContent}
                    onOpenNote={onOpenNote}
                    onOpenSettleUp={onOpenSettleUp}
                />
            </View>
        </View>
    );
}
