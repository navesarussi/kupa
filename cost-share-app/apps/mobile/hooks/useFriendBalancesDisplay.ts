import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    collectFriendFxCurrencies,
    friendBalanceRows,
    FriendBalance,
    FriendBalanceDisplay,
    resolveFriendDisplayBalance,
} from '@cost-share/shared';
import { fetchExchangeRates } from '../services/exchangeRates.service';

const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

export function useFriendBalancesDisplay(
    friends: FriendBalance[] | undefined,
    defaultCurrency: string | undefined,
): Map<string, FriendBalanceDisplay> {
    const base = defaultCurrency ?? 'ILS';

    const foreignCurrencies = useMemo(
        () => collectFriendFxCurrencies(friends ?? [], base),
        [friends, base],
    );

    const needsFx = foreignCurrencies.length > 0;

    const ratesQuery = useQuery({
        queryKey: ['exchangeRates', 'friends', base, foreignCurrencies.join(',')],
        queryFn: () => fetchExchangeRates(base, foreignCurrencies),
        enabled: needsFx,
        staleTime: CACHE_STALE_MS,
        gcTime: CACHE_STALE_MS,
        retry: 2,
    });

    return useMemo(() => {
        const map = new Map<string, FriendBalanceDisplay>();
        if (!friends?.length) return map;

        const rates = needsFx && ratesQuery.data?.rates ? ratesQuery.data.rates : undefined;

        for (const friend of friends) {
            const rows = friendBalanceRows(friend);
            const display = resolveFriendDisplayBalance(rows, base, rates);
            map.set(friend.userId, display);
        }
        return map;
    }, [friends, base, needsFx, ratesQuery.data?.rates]);
}
