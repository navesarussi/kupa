export type BalanceByCurrencyRow = {
    currency: string;
    owed: number;
    owedToUser: number;
};

/** Rates from Frankfurter: units of `currency` per 1 `baseCurrency`. */
export type RatesFromBase = Record<string, number>;

function roundMoney(value: number): number {
    return Number(value.toFixed(2));
}

/**
 * Convert an amount in `currency` to `baseCurrency` using rates where 1 base = rate[currency] units of currency.
 */
export function convertToBaseCurrency(
    amount: number,
    currency: string,
    baseCurrency: string,
    ratesFromBase: RatesFromBase,
): number | null {
    if (amount < 0.01) return 0;
    if (currency === baseCurrency) return amount;
    const rate = ratesFromBase[currency];
    if (!rate || rate <= 0 || !Number.isFinite(rate)) return null;
    return roundMoney(amount / rate);
}

/**
 * Sum balances when only the base currency has non-zero amounts (no FX needed).
 */
export function aggregateBalanceWithoutFx(
    rows: BalanceByCurrencyRow[],
    baseCurrency: string,
): { totalOwed: number; totalOwedToUser: number } | null {
    let totalOwed = 0;
    let totalOwedToUser = 0;

    for (const row of rows) {
        const hasBalance = row.owed >= 0.01 || row.owedToUser >= 0.01;
        if (row.currency !== baseCurrency && hasBalance) {
            return null;
        }
        if (row.currency === baseCurrency) {
            totalOwed += row.owed;
            totalOwedToUser += row.owedToUser;
        }
    }

    return {
        totalOwed: roundMoney(totalOwed),
        totalOwedToUser: roundMoney(totalOwedToUser),
    };
}

/**
 * Sum owed / owedToUser rows into the user's default currency.
 * Returns null totals if any row cannot be converted.
 */
export function aggregateBalanceInBaseCurrency(
    rows: BalanceByCurrencyRow[],
    baseCurrency: string,
    ratesFromBase: RatesFromBase,
): { totalOwed: number; totalOwedToUser: number } | null {
    let totalOwed = 0;
    let totalOwedToUser = 0;

    for (const row of rows) {
        const owed = convertToBaseCurrency(row.owed, row.currency, baseCurrency, ratesFromBase);
        const owedToUser = convertToBaseCurrency(row.owedToUser, row.currency, baseCurrency, ratesFromBase);
        if (owed === null || owedToUser === null) return null;
        totalOwed += owed;
        totalOwedToUser += owedToUser;
    }

    return {
        totalOwed: roundMoney(totalOwed),
        totalOwedToUser: roundMoney(totalOwedToUser),
    };
}
