/**
 * User-relative copy for settlement rows in the group feed.
 */

import type { Settlement } from '@cost-share/shared';

export type SettlementFeedPerspective = 'youPaid' | 'paidYou' | 'thirdParty';

export function resolveSettlementFeedPerspective(
    settlement: Settlement,
    currentUserId: string,
): SettlementFeedPerspective {
    if (settlement.fromUserId === currentUserId) return 'youPaid';
    if (settlement.toUserId === currentUserId) return 'paidYou';
    return 'thirdParty';
}

export function settlementFeedTitleKey(
    perspective: SettlementFeedPerspective,
): string {
    switch (perspective) {
        case 'youPaid':
            return 'feed.settlementYouClosedAndPaid';
        case 'paidYou':
            return 'feed.settlementClosedAndPaidYou';
        case 'thirdParty':
            return 'feed.settlementClosedAndPaidOther';
    }
}

export function buildSettlementFeedCopy(
    settlement: Settlement,
    currentUserId: string,
): { key: string } {
    const perspective = resolveSettlementFeedPerspective(
        settlement,
        currentUserId,
    );
    return { key: settlementFeedTitleKey(perspective) };
}
