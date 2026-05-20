const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            startAutoRefresh: (...args: unknown[]) => mockStartAutoRefresh(...args),
            stopAutoRefresh: (...args: unknown[]) => mockStopAutoRefresh(...args),
            getSession: (...args: unknown[]) => mockGetSession(...args),
            onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
        },
    },
}));

import { AppState } from 'react-native';
import {
    hydrateAuthSession,
    setupSupabaseAuthAutoRefresh,
    teardownSupabaseAuthAutoRefresh,
} from '../../lib/authSessionLifecycle';

describe('authSessionLifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        teardownSupabaseAuthAutoRefresh();
        mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
        Object.defineProperty(AppState, 'currentState', {
            configurable: true,
            value: 'active',
        });
        jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('starts auto refresh on setup', () => {
        setupSupabaseAuthAutoRefresh();
        expect(mockStartAutoRefresh).toHaveBeenCalled();
    });

    it('resolves hydrateAuthSession from INITIAL_SESSION', async () => {
        const session = { user: { id: 'user-1' } };
        const unsubscribe = jest.fn();
        mockOnAuthStateChange.mockImplementation((callback) => {
            callback('INITIAL_SESSION', session);
            return { data: { subscription: { unsubscribe } } };
        });

        await expect(hydrateAuthSession()).resolves.toBe(session);
        expect(mockGetSession).not.toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('falls back to getSession when INITIAL_SESSION is delayed', async () => {
        jest.useFakeTimers();
        const session = { user: { id: 'user-2' } };
        const unsubscribe = jest.fn();

        mockOnAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe } },
        });
        mockGetSession.mockResolvedValue({ data: { session }, error: null });

        const pending = hydrateAuthSession();
        jest.advanceTimersByTime(2500);

        await expect(pending).resolves.toBe(session);
        expect(unsubscribe).toHaveBeenCalled();
        jest.useRealTimers();
    });
});
