// Public client ID — safe to embed (no client_secret, implicit grant only)
const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID ?? 'bbsnyiujc5kp5r2tw29wv4skzevnar';
const STORAGE_KEY_TOKEN = 'pokepelago_twitch_oauth_token';
const STORAGE_KEY_TOKEN_TS = 'pokepelago_twitch_oauth_token_ts';
const STORAGE_KEY_USERNAME = 'pokepelago_twitch_oauth_username';
const STORAGE_KEY_EXPIRED = 'pokepelago_twitch_oauth_expired';
// Twitch implicit grant tokens expire after ~4 hours
const TOKEN_MAX_AGE_MS = 4 * 60 * 60 * 1000;
// Twitch requires connected apps to re-validate their token at least hourly
export const TOKEN_VALIDATE_INTERVAL_MS = 60 * 60 * 1000;

export const TWITCH_AUTH_CHANGED_EVENT = 'pokepelago_twitch_auth_changed';

export function notifyTwitchAuthChanged(): void {
    window.dispatchEvent(new Event(TWITCH_AUTH_CHANGED_EVENT));
}

export function getTwitchClientId(): string {
    return TWITCH_CLIENT_ID;
}

export function hasTwitchClientId(): boolean {
    return TWITCH_CLIENT_ID.length > 0;
}

export function getTwitchAuthUrl(): string {
    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = 'chat:read chat:edit';
    const params = new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: scopes,
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export function parseTwitchTokenFromHash(): string | null {
    const hash = window.location.hash;
    if (!hash.includes('access_token')) return null;
    const params = new URLSearchParams(hash.substring(1));
    return params.get('access_token');
}

export function clearHashFromUrl(): void {
    history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function storeTwitchToken(token: string): void {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_TOKEN_TS, String(Date.now()));
    localStorage.removeItem(STORAGE_KEY_EXPIRED);
}

/** True when the user asked for chat guessing, so a missing token is a problem worth showing. */
export function isTwitchChatEnabled(): boolean {
    return localStorage.getItem('pokepelago_twitch_enabled') === 'true';
}

export function getTwitchToken(): string | null {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) return null;
    const ts = localStorage.getItem(STORAGE_KEY_TOKEN_TS);
    if (ts && Date.now() - Number(ts) > TOKEN_MAX_AGE_MS) {
        // Token has aged out — clear it so the user re-authenticates
        expireTwitchAuth();
        return null;
    }
    return token;
}

export function storeTwitchUsername(username: string): void {
    localStorage.setItem(STORAGE_KEY_USERNAME, username);
}

export function getTwitchUsername(): string | null {
    return localStorage.getItem(STORAGE_KEY_USERNAME);
}

function removeStoredAuth(): void {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_TOKEN_TS);
    localStorage.removeItem(STORAGE_KEY_USERNAME);
}

/** User-initiated disconnect: forget everything, including the expiry marker. */
export function clearTwitchAuth(): void {
    removeStoredAuth();
    localStorage.removeItem(STORAGE_KEY_EXPIRED);
    notifyTwitchAuthChanged();
}

/**
 * Drop an expired or rejected token and remember that it went away on its own,
 * so the UI can offer a reconnect instead of silently falling back to anonymous chat.
 */
export function expireTwitchAuth(): void {
    const hadAuth = localStorage.getItem(STORAGE_KEY_TOKEN) !== null
        || localStorage.getItem(STORAGE_KEY_USERNAME) !== null;
    removeStoredAuth();
    if (hadAuth) localStorage.setItem(STORAGE_KEY_EXPIRED, 'true');
    notifyTwitchAuthChanged();
}

/** True when the last sign-in ended because the token expired or Twitch rejected it. */
export function isTwitchAuthExpired(): boolean {
    return localStorage.getItem(STORAGE_KEY_EXPIRED) === 'true';
}

export interface TwitchValidateResponse {
    login: string;
    user_id: string;
    scopes: string[];
}

export async function validateTwitchToken(token: string): Promise<TwitchValidateResponse | null> {
    try {
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: { Authorization: `OAuth ${token}` },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Re-check the stored token against Twitch. Clears the stored auth (and notifies
 * listeners) when the token is gone or rejected, so the UI can prompt for re-auth.
 * Returns true only when a token is still valid.
 */
export async function revalidateTwitchToken(): Promise<boolean> {
    const token = getTwitchToken();
    if (!token) {
        // getTwitchToken() already cleared an aged-out token and notified listeners.
        return false;
    }
    const result = await validateTwitchToken(token);
    if (!result) {
        expireTwitchAuth();
        return false;
    }
    if (getTwitchUsername() !== result.login) {
        storeTwitchUsername(result.login);
        notifyTwitchAuthChanged();
    }
    return true;
}
