import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthStorage = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};

const webStorage: AuthStorage = {
    getItem: (key) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
    setItem: (key, value) => {
        globalThis.localStorage?.setItem(key, value);
        return Promise.resolve();
    },
    removeItem: (key) => {
        globalThis.localStorage?.removeItem(key);
        return Promise.resolve();
    },
};

/** Platform-aware storage adapter for Supabase auth session persistence. */
export const authStorage: AuthStorage =
    Platform.OS === 'web' ? webStorage : AsyncStorage;
