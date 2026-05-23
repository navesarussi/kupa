const mockRpc = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: (...a: any[]) => mockRpc(...a), auth: { signOut: (...a: any[]) => mockSignOut(...a) } },
}));

import { deleteMyAccount, getMyOpenBalances } from '../../services/account.service';

beforeEach(() => {
    mockRpc.mockReset();
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
});

describe('deleteMyAccount', () => {
    it('calls RPC then signs out globally and returns ok on success', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        const result = await deleteMyAccount();

        expect(result).toEqual({ ok: true });
        expect(mockRpc).toHaveBeenCalledWith('delete_my_account');
        expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
    });

    it('returns error and does NOT sign out when RPC fails', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

        const result = await deleteMyAccount();

        expect(result).toEqual({ ok: false, error: 'deleteAccount.deleteFailed' });
        expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('returns ok even when signOut throws (account already deactivated)', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });
        mockSignOut.mockResolvedValue({ error: { message: 'network' } });

        const result = await deleteMyAccount();

        expect(result).toEqual({ ok: true });
    });
});

describe('getMyOpenBalances', () => {
    it('returns hasOpenBalances=false when summary array is empty', async () => {
        mockRpc.mockResolvedValue({
            data: { summary: [], byGroup: [] },
            error: null,
        });

        const result = await getMyOpenBalances();

        expect(mockRpc).toHaveBeenCalledWith('get_my_open_balances');
        expect(result).toEqual({
            hasOpenBalances: false,
            totalOwed: 0,
            totalOwing: 0,
            currency: 'ILS',
        });
    });

    it('aggregates owed and owing across currencies and picks the largest as display currency', async () => {
        mockRpc.mockResolvedValue({
            data: {
                summary: [
                    { currency: 'ILS', owed: 100, owe: 20, net: 80 },
                    { currency: 'USD', owed: 50, owe: 5, net: 45 },
                ],
                byGroup: [],
            },
            error: null,
        });

        const result = await getMyOpenBalances();

        expect(result.hasOpenBalances).toBe(true);
        expect(result.totalOwed).toBe(150);
        expect(result.totalOwing).toBe(25);
        expect(result.currency).toBe('ILS');
    });

    it('falls back to ILS currency on RPC error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

        const result = await getMyOpenBalances();

        expect(result).toEqual({
            hasOpenBalances: false,
            totalOwed: 0,
            totalOwing: 0,
            currency: 'ILS',
        });
    });
});
