import { AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function syncAutoRefresh(appState: AppStateStatus) {
    if (appState === 'active') {
        void supabase.auth.startAutoRefresh();
        return;
    }

    void supabase.auth.stopAutoRefresh();
}

/** Keeps Supabase access tokens fresh while the app is foregrounded. */
export function setupSupabaseAuthAutoRefresh(): void {
    if (appStateSubscription) return;

    syncAutoRefresh(AppState.currentState);
    appStateSubscription = AppState.addEventListener('change', syncAutoRefresh);
}

export function teardownSupabaseAuthAutoRefresh(): void {
    appStateSubscription?.remove();
    appStateSubscription = null;
    void supabase.auth.stopAutoRefresh();
}

/**
 * Waits for Supabase to hydrate the persisted session from storage before routing.
 * Prefers INITIAL_SESSION; falls back to getSession() for older clients.
 */
export function hydrateAuthSession(): Promise<Session | null> {
    return new Promise((resolve) => {
        let settled = false;
        let subscription: { unsubscribe: () => void } | null = null;

        const finish = (session: Session | null) => {
            if (settled) return;
            settled = true;
            subscription?.unsubscribe();
            clearTimeout(timeoutId);
            resolve(session);
        };

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') {
                queueMicrotask(() => finish(session));
            }
        });
        subscription = authSubscription;

        const timeoutId = setTimeout(() => {
            void supabase.auth.getSession().then(({ data: { session } }) => finish(session));
        }, 2500);
    });
}
