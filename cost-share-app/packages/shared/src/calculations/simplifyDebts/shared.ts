/**
 * Internal building blocks shared by the exact + greedy debt-simplification
 * algorithms. Working in integer cents avoids floating-point drift and lets
 * the exact algorithm memoize on a stable string key.
 */

/**
 * Thrown when the input balances do not sum to zero within tolerance.
 * The Balances screen catches this and renders an empty state rather
 * than crashing on corrupt data.
 */
export class UnbalancedLedgerError extends Error {
    constructor(message = 'Net balances do not sum to zero') {
        super(message);
        this.name = 'UnbalancedLedgerError';
    }
}

/** Maximum number of non-zero balances at which we still run the exact algorithm. */
export const EXACT_THRESHOLD = 10;

/** Internal: a user's balance expressed in integer cents. */
export interface CentBalance {
    userId: string;
    cents: number; // positive = creditor, negative = debtor
}

/** Internal: a single transfer expressed in integer cents. */
export interface CentTransfer {
    fromUserId: string;
    toUserId: string;
    cents: number; // always positive
}

/** Round a decimal amount to integer cents. */
export function toCents(amount: number): number {
    return Math.round(amount * 100);
}

/** Convert integer cents back to a 2-decimal amount. */
export function centsToAmount(cents: number): number {
    return Number((cents / 100).toFixed(2));
}
