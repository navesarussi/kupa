import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStorage } from '../../lib/authStorage';

describe('authStorage', () => {
    beforeEach(() => {
        globalThis.localStorage?.clear();
        void AsyncStorage.clear();
    });

    it('persists values on native via AsyncStorage', async () => {
        if (Platform.OS === 'web') {
            return;
        }

        await authStorage.setItem('auth-token', 'session-value');
        await expect(authStorage.getItem('auth-token')).resolves.toBe('session-value');
        await authStorage.removeItem('auth-token');
        await expect(authStorage.getItem('auth-token')).resolves.toBeNull();
    });

    it('persists values on web via localStorage', async () => {
        if (Platform.OS !== 'web') {
            return;
        }

        await authStorage.setItem('auth-token', 'session-value');
        expect(globalThis.localStorage?.getItem('auth-token')).toBe('session-value');
        await authStorage.removeItem('auth-token');
        expect(globalThis.localStorage?.getItem('auth-token')).toBeNull();
    });
});
