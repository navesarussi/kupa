import {
    simplifyDebtsGreedy,
} from '@cost-share/shared/calculations/simplifyDebts/greedy';
import type { CentBalance } from '@cost-share/shared/calculations/simplifyDebts/shared';
import {
    simplifyDebtsExact,
} from '@cost-share/shared/calculations/simplifyDebts/exact';

/**
 * Helper: assert applying all transfers zeroes every balance.
 * Operates on integer cents to avoid floating-point noise.
 */
function assertBalancesZeroed(
    balances: CentBalance[],
    transfers: { fromUserId: string; toUserId: string; cents: number }[],
): void {
    const net = new Map<string, number>();
    for (const b of balances) net.set(b.userId, b.cents);
    for (const t of transfers) {
        net.set(t.fromUserId, (net.get(t.fromUserId) ?? 0) + t.cents);
        net.set(t.toUserId, (net.get(t.toUserId) ?? 0) - t.cents);
    }
    for (const [userId, cents] of net) {
        expect({ userId, cents }).toEqual({ userId, cents: 0 });
    }
}

describe('simplifyDebtsGreedy', () => {
    it('returns no transfers when all balances are zero', () => {
        expect(simplifyDebtsGreedy([])).toEqual([]);
    });

    it('handles two-person debt', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: 5000 },
        ];
        const transfers = simplifyDebtsGreedy(balances);
        expect(transfers).toEqual([
            { fromUserId: 'A', toUserId: 'B', cents: 5000 },
        ]);
        assertBalancesZeroed(balances, transfers);
    });

    it('matches largest debtor with largest creditor first', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: 2000 },
            { userId: 'C', cents: 1500 },
            { userId: 'D', cents: 1000 },
            { userId: 'E', cents: 500 },
        ];
        const transfers = simplifyDebtsGreedy(balances);
        // A is the only debtor; first match must go to the largest creditor (B).
        expect(transfers[0]).toEqual({ fromUserId: 'A', toUserId: 'B', cents: 2000 });
        expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
        assertBalancesZeroed(balances, transfers);
    });

    it('produces at most k-1 transfers for k non-zero members', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -3000 },
            { userId: 'B', cents: -2000 },
            { userId: 'C', cents: 1500 },
            { userId: 'D', cents: 1500 },
            { userId: 'E', cents: 2000 },
        ];
        const transfers = simplifyDebtsGreedy(balances);
        expect(transfers.length).toBeLessThanOrEqual(4);
        assertBalancesZeroed(balances, transfers);
    });
});

describe('simplifyDebtsExact', () => {
    it('returns no transfers when all balances are zero', () => {
        expect(simplifyDebtsExact([])).toEqual([]);
    });

    it('handles two-person debt with a single transfer', () => {
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: 5000 },
        ];
        const transfers = simplifyDebtsExact(balances);
        expect(transfers).toHaveLength(1);
        assertBalancesZeroed(balances, transfers);
    });

    it('produces the minimum number of transfers (classic Splitwise counterexample)', () => {
        // Naive unsorted greedy can do 4 here; optimal is 3.
        // A=-50, B=-10, C=+30, D=+30, can be settled in 3 transfers:
        //   B->C 10, A->C 20, A->D 30  (3 transfers)
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: -1000 },
            { userId: 'C', cents: 3000 },
            { userId: 'D', cents: 3000 },
        ];
        const transfers = simplifyDebtsExact(balances);
        expect(transfers.length).toBe(3);
        assertBalancesZeroed(balances, transfers);
    });

    it('finds the optimal solution when a subset sums perfectly', () => {
        // {-5, -10, +3, +12} — debtors total -15, creditors total +15.
        // Optimal: 2 transfers if a subset sums match perfectly, else 3.
        // Here {-3 from -5}+{-12 from -10} doesn't work; minimum is 3.
        // But {-50, -25, +25, +50}: {-25 to +25, -50 to +50} = 2 transfers.
        const balances: CentBalance[] = [
            { userId: 'A', cents: -5000 },
            { userId: 'B', cents: -2500 },
            { userId: 'C', cents: 2500 },
            { userId: 'D', cents: 5000 },
        ];
        const transfers = simplifyDebtsExact(balances);
        expect(transfers.length).toBe(2);
        assertBalancesZeroed(balances, transfers);
    });

    it('handles 10 non-zero balances within budget', () => {
        // 5 debtors / 5 creditors with mixed magnitudes.
        const balances: CentBalance[] = [
            { userId: 'd1', cents: -1000 },
            { userId: 'd2', cents: -1500 },
            { userId: 'd3', cents: -2000 },
            { userId: 'd4', cents: -2500 },
            { userId: 'd5', cents: -3000 },
            { userId: 'c1', cents: 500 },
            { userId: 'c2', cents: 1500 },
            { userId: 'c3', cents: 2000 },
            { userId: 'c4', cents: 2500 },
            { userId: 'c5', cents: 3500 },
        ];
        const t0 = Date.now();
        const transfers = simplifyDebtsExact(balances);
        const elapsed = Date.now() - t0;
        assertBalancesZeroed(balances, transfers);
        expect(transfers.length).toBeLessThanOrEqual(9); // k-1 upper bound
        expect(elapsed).toBeLessThan(500); // generous CI bound; expected <5 ms
    });

    it('tie-breaks toward the largest first transfer when counts are equal', () => {
        // Two valid 1-transfer solutions exist (only one debtor/creditor pair),
        // so the first transfer is unambiguous. Use a 2-transfer scenario where
        // either creditor could be visited first; prefer the larger amount.
        const balances: CentBalance[] = [
            { userId: 'A', cents: -3000 },
            { userId: 'B', cents: 1000 },
            { userId: 'C', cents: 2000 },
        ];
        const transfers = simplifyDebtsExact(balances);
        expect(transfers.length).toBe(2);
        // First transfer should be the larger one (A -> C, 2000).
        expect(transfers[0]).toEqual({ fromUserId: 'A', toUserId: 'C', cents: 2000 });
    });
});
