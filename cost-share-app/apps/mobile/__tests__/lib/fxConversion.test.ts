import {
    aggregateBalanceInBaseCurrency,
    aggregateBalanceWithoutFx,
    convertToBaseCurrency,
} from '@cost-share/shared';

describe('fxConversion', () => {
    const rates = { USD: 0.27, EUR: 0.24 };

    it('convertToBaseCurrency returns same amount for base currency', () => {
        expect(convertToBaseCurrency(100, 'ILS', 'ILS', rates)).toBe(100);
    });

    it('convertToBaseCurrency divides foreign amount by rate', () => {
        expect(convertToBaseCurrency(27, 'USD', 'ILS', rates)).toBe(100);
    });

    it('aggregateBalanceInBaseCurrency sums converted rows', () => {
        const result = aggregateBalanceInBaseCurrency(
            [
                { currency: 'ILS', owed: 10, owedToUser: 0 },
                { currency: 'USD', owed: 0, owedToUser: 27 },
            ],
            'ILS',
            rates,
        );
        expect(result).toEqual({ totalOwed: 10, totalOwedToUser: 100 });
    });

    it('aggregateBalanceWithoutFx sums base currency when others are zero', () => {
        const result = aggregateBalanceWithoutFx(
            [
                { currency: 'ILS', owed: 0, owedToUser: 0 },
                { currency: 'USD', owed: 0, owedToUser: 4_782_537 },
            ],
            'USD',
        );
        expect(result).toEqual({ totalOwed: 0, totalOwedToUser: 4_782_537 });
    });

    it('returns null when a rate is missing', () => {
        expect(
            aggregateBalanceInBaseCurrency(
                [{ currency: 'GBP', owed: 5, owedToUser: 0 }],
                'ILS',
                rates,
            ),
        ).toBeNull();
    });
});
