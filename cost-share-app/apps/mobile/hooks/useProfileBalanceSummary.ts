import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    aggregateBalanceInBaseCurrency,
    aggregateBalanceWithoutFx,
    BalanceSummary,
} from '@cost-share/shared';
import { fetchExchangeRates } from '../services/exchangeRates.service';

const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

export type ProfileBalanceConversion = {
    isConverted: boolean;
    ratesDate: string | null;
    isLoading: boolean;
    failed: boolean;
};

function needsConversion(summary: BalanceSummary | undefined): boolean {
    if (!summary) return false;
    if (summary.byCurrency.length === 0) return false;
    return summary.totalOwed === null || summary.totalOwedToUser === null;
}

export function useProfileBalanceSummary(
    raw: BalanceSummary | undefined,
): { summary: BalanceSummary | undefined; conversion: ProfileBalanceConversion } {
    const localTotals = useMemo(() => {
        if (!raw || !needsConversion(raw)) return null;
        return aggregateBalanceWithoutFx(raw.byCurrency, raw.defaultCurrency);
    }, [raw]);

    const foreignCurrencies = useMemo(() => {
        if (!raw) return [];
        return raw.byCurrency
            .map((r) => r.currency)
            .filter((c) => c !== raw.defaultCurrency);
    }, [raw]);

    const fxEnabled = needsConversion(raw) && localTotals === null;

    const sortedForeign = useMemo(
        () => [...foreignCurrencies].sort((a, b) => a.localeCompare(b)),
        [foreignCurrencies],
    );

    const ratesQuery = useQuery({
        queryKey: ['exchangeRates', raw?.defaultCurrency, sortedForeign.join(',')],
        queryFn: () => fetchExchangeRates(raw!.defaultCurrency, sortedForeign),
        enabled: fxEnabled,
        staleTime: CACHE_STALE_MS,
        gcTime: CACHE_STALE_MS,
        retry: 2,
    });

    const summary = useMemo((): BalanceSummary | undefined => {
        if (!raw) return undefined;
        if (!needsConversion(raw)) return raw;

        if (localTotals) {
            return { ...raw, totalOwed: localTotals.totalOwed, totalOwedToUser: localTotals.totalOwedToUser };
        }

        if (ratesQuery.isLoading || ratesQuery.isError || !ratesQuery.data) return raw;

        const aggregated = aggregateBalanceInBaseCurrency(
            raw.byCurrency,
            raw.defaultCurrency,
            ratesQuery.data.rates,
        );
        if (!aggregated) return raw;

        return {
            ...raw,
            totalOwed: aggregated.totalOwed,
            totalOwedToUser: aggregated.totalOwedToUser,
        };
    }, [raw, localTotals, ratesQuery.data, ratesQuery.isLoading, ratesQuery.isError]);

    const fxConverted =
        fxEnabled && !!ratesQuery.data && !ratesQuery.isError && summary?.totalOwed !== null;

    const conversion: ProfileBalanceConversion = {
        isConverted: !!localTotals || fxConverted,
        ratesDate: localTotals ? null : ratesQuery.data?.date ?? null,
        isLoading: fxEnabled && ratesQuery.isLoading,
        failed: fxEnabled && !ratesQuery.isLoading && (ratesQuery.isError || !ratesQuery.data),
    };

    return { summary, conversion };
}
