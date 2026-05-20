import type { CentBalance, CentTransfer } from './shared';

/**
 * Exact debt simplification: returns the shortest possible list of
 * transfers that zeroes every balance. Pure backtracking with two
 * pruning tricks:
 *
 *   1. Branch-and-bound — we abandon any branch that already has
 *      more transfers than the best complete solution seen so far.
 *   2. Memoization — when we revisit the same multiset of remaining
 *      balances, we already know the best length from there.
 *
 * Tie-breaker: among solutions of equal length, prefer the one whose
 * first transfer is largest. This matches Splitwise's "round numbers
 * first" feel and is stable across runs.
 *
 * Intended for k ≤ 10. Expected runtime <1 ms on mobile for k ≤ 10.
 *
 * Input balances are assumed to sum to zero; the orchestrator validates.
 */
export function simplifyDebtsExact(input: CentBalance[]): CentTransfer[] {
    if (input.length === 0) return [];

    const memo = new Map<string, number>(); // stateKey -> best length from here
    let best: CentTransfer[] = [];
    let bestLength = Number.POSITIVE_INFINITY;

    /** Stable key for the current multiset of balances. */
    function stateKey(balances: CentBalance[]): string {
        return balances
            .filter(b => b.cents !== 0)
            .map(b => `${b.userId}:${b.cents}`)
            .sort()
            .join('|');
    }

    function search(balances: CentBalance[], path: CentTransfer[]): void {
        // Prune: branch already worse than best known full solution.
        if (path.length >= bestLength) return;

        const remaining = balances.filter(b => b.cents !== 0);
        if (remaining.length === 0) {
            // Found a complete solution. Update best with tie-breaker on
            // first transfer amount.
            if (
                path.length < bestLength
                || (path.length === bestLength
                    && best.length > 0
                    && path[0].cents > best[0].cents)
            ) {
                best = path.slice();
                bestLength = path.length;
            }
            return;
        }

        const key = stateKey(remaining);
        const seenBest = memo.get(key);
        // If we've reached this state before with no fewer transfers ahead
        // than we'd need to beat `bestLength`, skip.
        if (seenBest !== undefined && path.length + seenBest >= bestLength) {
            return;
        }

        // Pick the first debtor deterministically.
        const debtor = remaining.find(b => b.cents < 0)!;
        const creditors = remaining.filter(b => b.cents > 0);

        // Try larger creditors first — this finds good solutions fast and
        // makes the branch-and-bound prune aggressively. Also aligns with
        // the tie-breaker.
        creditors.sort((a, b) => b.cents - a.cents);

        for (const creditor of creditors) {
            const amount = Math.min(-debtor.cents, creditor.cents);
            const next = balances.map(b => {
                if (b.userId === debtor.userId) return { ...b, cents: b.cents + amount };
                if (b.userId === creditor.userId) return { ...b, cents: b.cents - amount };
                return b;
            });
            path.push({
                fromUserId: debtor.userId,
                toUserId: creditor.userId,
                cents: amount,
            });
            search(next, path);
            path.pop();
        }

        // Record best-length-from-here for memoization. We only know an
        // upper bound (the best we found), but that's enough to prune.
        const lengthFromHere = bestLength - path.length;
        if (seenBest === undefined || lengthFromHere < seenBest) {
            memo.set(key, lengthFromHere);
        }
    }

    search(input.map(b => ({ ...b })), []);
    return best;
}
