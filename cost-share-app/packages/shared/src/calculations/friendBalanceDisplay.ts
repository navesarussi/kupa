import type { FriendBalanceByCurrency } from '../types';
import { convertToBaseCurrency, type RatesFromBase } from './fxConversion';

export type FriendBalanceDisplay = {
    netBalance: number;
    currency: string;
    isConverted: boolean;
    conversionFailed?: boolean;
};

function roundMoney(value: number): number {
    return Number(value.toFixed(2));
}

/** Normalize RPC payload (byCurrency) or legacy single-currency fields. */
export function friendBalanceRows(friend: {
    byCurrency?: FriendBalanceByCurrency[];
    netBalance?: number;
    currency?: string;
}): FriendBalanceByCurrency[] {
    if (friend.byCurrency && friend.byCurrency.length > 0) {
        return friend.byCurrency;
    }
    if (friend.netBalance !== undefined && friend.currency) {
        return [{ currency: friend.currency, netBalance: friend.netBalance }];
    }
    return [];
}

/**
 * Pick amount/currency for profile friend row.
 * Single active currency → native; multiple → sum in defaultCurrency (FX when needed).
 */
export function resolveFriendDisplayBalance(
    rows: FriendBalanceByCurrency[],
    defaultCurrency: string,
    ratesFromBase?: RatesFromBase,
): FriendBalanceDisplay {
    const active = rows.filter((r) => Math.abs(r.netBalance) >= 0.01);

    if (active.length === 0) {
        return { netBalance: 0, currency: defaultCurrency, isConverted: false };
    }

    if (active.length === 1) {
        return {
            netBalance: active[0].netBalance,
            currency: active[0].currency,
            isConverted: false,
        };
    }

    const distinctCurrencies = new Set(active.map((r) => r.currency));
    if (distinctCurrencies.size === 1) {
        const sum = active.reduce((s, r) => s + r.netBalance, 0);
        return {
            netBalance: roundMoney(sum),
            currency: active[0].currency,
            isConverted: false,
        };
    }

    const allInBase = active.every((r) => r.currency === defaultCurrency);
    if (allInBase) {
        const sum = active.reduce((s, r) => s + r.netBalance, 0);
        return { netBalance: roundMoney(sum), currency: defaultCurrency, isConverted: false };
    }

    if (!ratesFromBase) {
        return {
            netBalance: 0,
            currency: defaultCurrency,
            isConverted: true,
            conversionFailed: true,
        };
    }

    let total = 0;
    for (const row of active) {
        const converted = convertToBaseCurrency(
            Math.abs(row.netBalance),
            row.currency,
            defaultCurrency,
            ratesFromBase,
        );
        if (converted === null) {
            return {
                netBalance: 0,
                currency: defaultCurrency,
                isConverted: true,
                conversionFailed: true,
            };
        }
        total += row.netBalance >= 0 ? converted : -converted;
    }

    return {
        netBalance: roundMoney(total),
        currency: defaultCurrency,
        isConverted: true,
    };
}

/** Collect foreign currencies that need FX for a set of friends. */
export function collectFriendFxCurrencies(
    friends: { byCurrency?: FriendBalanceByCurrency[]; netBalance?: number; currency?: string }[],
    defaultCurrency: string,
): string[] {
    const set = new Set<string>();
    for (const friend of friends) {
        const rows = friendBalanceRows(friend);
        const active = rows.filter((r) => Math.abs(r.netBalance) >= 0.01);
        const currencies = new Set(active.map((r) => r.currency));
        if (currencies.size <= 1) continue;
        for (const c of currencies) {
            if (c !== defaultCurrency) set.add(c);
        }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}
