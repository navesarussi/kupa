import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchExchangeRates } from '../../services/exchangeRates.service';

describe('fetchExchangeRates', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        global.fetch = jest.fn();
    });

    it('fetches rates from open.er-api and caches them', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                result: 'success',
                base_code: 'USD',
                time_last_update_unix: 1779235351,
                rates: { USD: 1, ILS: 3.65, EUR: 0.92 },
            }),
        });

        const first = await fetchExchangeRates('USD', ['ILS']);
        expect(first.rates).toEqual({ ILS: 3.65 });
        expect(first.date).toBe('2026-05-20');
        expect(global.fetch).toHaveBeenCalledWith('https://open.er-api.com/v6/latest/USD');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const second = await fetchExchangeRates('USD', ['ILS']);
        expect(second).toEqual(first);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws when API response is missing a symbol', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                result: 'success',
                base_code: 'ILS',
                rates: { ILS: 1 },
            }),
        });

        await expect(fetchExchangeRates('ILS', ['USD'])).rejects.toThrow(/Missing exchange rates/);
    });
});
