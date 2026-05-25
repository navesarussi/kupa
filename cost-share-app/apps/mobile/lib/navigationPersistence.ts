import type { NavigationState } from '@react-navigation/native';
import { authStorage } from './authStorage';

const NAVIGATION_STATE_KEY = 'NAVIGATION_STATE_V1';

export async function loadNavigationState(): Promise<NavigationState | undefined> {
    try {
        const raw = await authStorage.getItem(NAVIGATION_STATE_KEY);
        if (!raw) return undefined;
        return JSON.parse(raw) as NavigationState;
    } catch {
        return undefined;
    }
}

export async function saveNavigationState(state: NavigationState | undefined): Promise<void> {
    if (!state) return;
    try {
        await authStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
    } catch {
        // Best-effort; navigation still works if persistence fails.
    }
}

export async function clearNavigationState(): Promise<void> {
    await authStorage.removeItem(NAVIGATION_STATE_KEY);
}
