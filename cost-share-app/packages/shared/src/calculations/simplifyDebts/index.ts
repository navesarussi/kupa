import { DebtSummary, SimplifiedDebtsResult, UserBalance } from '../../types';
import { simplifyDebtsExact } from './exact';
import { simplifyDebtsGreedy } from './greedy';
import {
    CentBalance,
    CentTransfer,
    EXACT_THRESHOLD,
    UnbalancedLedgerError,
    centsToAmount,
    toCents,
} from './shared';

export { simplifyDebtsExact } from './exact';
export { simplifyDebtsGreedy } from './greedy';
export { UnbalancedLedgerError } from './shared';

/**
 * Compute the minimum (or near-minimum) list of transfers that settles
 * every member's net balance in a group.
 *
 * For ≤10 non-zero balances we run an exact backtracking search and
 * return `algorithm: 'exact'` — the count is provably minimal. Above
 * the threshold we use a sorted-matching heuristic and return
 * `algorithm: 'greedy'`.
 *
 * Throws `UnbalancedLedgerError` if the input balances do not sum to
 * zero (within ±1 cent of tolerance from rounding).
 */
export function simplifyDebts(
    balances: UserBalance[],
    nameById: Map<string, string>,
): SimplifiedDebtsResult {
    // Work in integer cents from here on.
    const cents: CentBalance[] = balances.map(b => ({
        userId: b.userId,
        cents: toCents(b.netBalance),
    }));

    const nonZero = cents.filter(b => b.cents !== 0);

    if (nonZero.length === 0) {
        return { debts: [], transactionCount: 0, algorithm: 'exact' };
    }

    // Sanity check: a valid ledger always sums to zero. With per-row
    // rounding to 2dp, drift can be at most ±(n/2) cents, but for a
    // well-formed group it should be exactly 0. Anything else means the
    // input is corrupt — refuse rather than producing garbage transfers.
    const totalCents = nonZero.reduce((s, b) => s + b.cents, 0);
    if (totalCents !== 0) {
        throw new UnbalancedLedgerError(
            `Net balances sum to ${totalCents} cents (expected 0)`,
        );
    }
    if (nonZero.length < 2) {
        // Sum is 0 but only one non-zero member — impossible unless data
        // is corrupt. Treat as unbalanced.
        throw new UnbalancedLedgerError('Single non-zero member detected');
    }

    const useExact = nonZero.length <= EXACT_THRESHOLD;
    const transfers: CentTransfer[] = useExact
        ? simplifyDebtsExact(nonZero)
        : simplifyDebtsGreedy(nonZero);

    // Map currency from the original balances (one currency per group).
    const currency = balances[0]?.currency ?? 'USD';

    const debts: DebtSummary[] = transfers.map(t => ({
        fromUserId: t.fromUserId,
        fromUserName: nameById.get(t.fromUserId) ?? 'Unknown',
        toUserId: t.toUserId,
        toUserName: nameById.get(t.toUserId) ?? 'Unknown',
        amount: centsToAmount(t.cents),
        currency,
    }));

    return {
        debts,
        transactionCount: debts.length,
        algorithm: useExact ? 'exact' : 'greedy',
    };
}
