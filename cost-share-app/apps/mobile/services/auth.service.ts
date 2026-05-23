import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { clearGroupFeedHydration } from '../lib/groupFeedCache';
import { queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const NATIVE_SCHEME = 'com.kupa.mobile';
const AUTH_CALLBACK_PATH = 'auth/callback';

/**
 * Expo Go on a physical device often resolves Metro as `localhost`, which is unreachable
 * from the phone. Prefer the LAN host from Expo config, and never use localhost on native.
 */
function resolveNativeOAuthRedirectUri(): string {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  let uri = makeRedirectUri({
    scheme: isExpoGo ? undefined : NATIVE_SCHEME,
    path: AUTH_CALLBACK_PATH,
    preferLocalhost: false,
  });

  const hostUri = Constants.expoConfig?.hostUri;
  if (uri.includes('localhost') && hostUri && !hostUri.includes('localhost')) {
    uri = uri.replace(/localhost(?=:\d+)?/, hostUri.split(':')[0]);
  }

  if (uri.includes('localhost')) {
    uri = `${NATIVE_SCHEME}://${AUTH_CALLBACK_PATH}`;
  }

  return uri;
}

function resolveWebOAuthRedirectUri(): string {
  const origin = globalThis.location?.origin;
  if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    return `${origin}/${AUTH_CALLBACK_PATH}`;
  }

  const configured = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return `${configured}/${AUTH_CALLBACK_PATH}`;
  }

  if (origin) {
    return `${origin}/${AUTH_CALLBACK_PATH}`;
  }

  return `https://kupa.pro/${AUTH_CALLBACK_PATH}`;
}

/** Prevents double exchange when WebBrowser and Linking both deliver the same callback URL. */
const exchangeByCode = new Map<string, Promise<{ error: Error | null }>>();

export async function handleAuthRedirectUrl(url: string): Promise<{ error: Error | null }> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    return { error: new Error(errorCode) };
  }

  const { code, access_token, refresh_token } = params;

  if (code) {
    const existing = exchangeByCode.get(code);
    if (existing) return existing;

    const exchange = (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { error };
    })();

    exchangeByCode.set(code, exchange);
    try {
      return await exchange;
    } finally {
      exchangeByCode.delete(code);
    }
  }

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error };
  }

  return { error: new Error(`No auth params in redirect URL: ${url}`) };
}

export function getAuthRedirectUri(): string {
  return Platform.OS === 'web'
    ? resolveWebOAuthRedirectUri()
    : resolveNativeOAuthRedirectUri();
}

export function isAuthCallbackUrl(url: string): boolean {
  if (!url.includes(AUTH_CALLBACK_PATH)) return false;
  const { params } = QueryParams.getQueryParams(url);
  return Boolean(params.code || params.access_token || params.error || params.error_description);
}

const googleOAuthOptions = (oauthRedirect: string) => ({
  redirectTo: oauthRedirect,
  queryParams: { prompt: 'select_account' },
});

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const oauthRedirect = getAuthRedirectUri();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: googleOAuthOptions(oauthRedirect),
    });
    return { error };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      ...googleOAuthOptions(oauthRedirect),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return { error: error ?? new Error('No OAuth URL returned') };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirect, {
    preferEphemeralSession: true,
  });

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { error: new Error('Sign-in was cancelled') };
  }

  if (result.type !== 'success') {
    return { error: new Error(`Unexpected browser result: ${result.type}`) };
  }

  return handleAuthRedirectUrl(result.url);
}

export async function signOut(): Promise<void> {
  clearGroupFeedHydration();
  exchangeByCode.clear();
  queryClient.clear();
  await supabase.auth.signOut({ scope: 'global' });
}
