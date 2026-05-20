import {
    collectFriendFxCurrencies,
    friendBalanceRows,
    resolveFriendDisplayBalance,
} from '@cost-share/shared';

describe('friendBalanceDisplay', () => {
    const rates = { USD: 0.27, EUR: 0.24 };

    it('friendBalanceRows prefers byCurrency', () => {
        expect(
            friendBalanceRows({
                byCurrency: [{ currency: 'ILS', netBalance: 10 }],
                netBalance: 99,
                currency: 'USD',
            }),
        ).toEqual([{ currency: 'ILS', netBalance: 10 }]);
    });

    it('resolveFriendDisplayBalance uses native currency for single row', () => {
        expect(
            resolveFriendDisplayBalance([{ currency: 'ILS', netBalance: 272.5 }], 'USD'),
        ).toEqual({ netBalance: 272.5, currency: 'ILS', isConverted: false });
    });

    it('resolveFriendDisplayBalance sums same currency without FX', () => {
        expect(
            resolveFriendDisplayBalance(
                [
                    { currency: 'ILS', netBalance: 100 },
                    { currency: 'ILS', netBalance: 50 },
                ],
                'USD',
            ),
        ).toEqual({ netBalance: 150, currency: 'ILS', isConverted: false });
    });

    it('resolveFriendDisplayBalance converts multi-currency to default', () => {
        expect(
            resolveFriendDisplayBalance(
                [
                    { currency: 'ILS', netBalance: 100 },
                    { currency: 'USD', netBalance: -27 },
                ],
                'ILS',
                rates,
            ),
        ).toEqual({ netBalance: 0, currency: 'ILS', isConverted: true });
    });

    it('collectFriendFxCurrencies skips single-currency friends', () => {
        expect(
            collectFriendFxCurrencies(
                [{ byCurrency: [{ currency: 'ILS', netBalance: 10 }] }],
                'USD',
            ),
        ).toEqual([]);
    });

    it('collectFriendFxCurrencies lists foreign currencies for multi-currency friends', () => {
        expect(
            collectFriendFxCurrencies(
                [
                    {
                        byCurrency: [
                            { currency: 'ILS', netBalance: 10 },
                            { currency: 'USD', netBalance: -5 },
                        ],
                    },
                ],
                'ILS',
            ),
        ).toEqual(['USD']);
    });
});
