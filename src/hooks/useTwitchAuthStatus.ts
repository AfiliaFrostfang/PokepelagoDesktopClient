import { useEffect, useState } from 'react';
import {
    TWITCH_AUTH_CHANGED_EVENT,
    getTwitchToken,
    getTwitchUsername,
    hasTwitchClientId,
    isTwitchAuthExpired,
    isTwitchChatEnabled,
} from '../services/twitchAuthService';

export interface TwitchAuthStatus {
    /** Twitch login of the connected account, or null when not connected. */
    username: string | null;
    /** Chat guessing is switched on but the Twitch sign-in is gone or expired. */
    needsReauth: boolean;
}

function readStatus(): TwitchAuthStatus {
    // getTwitchToken() drops an aged-out token, so a null here means "sign in again".
    const hasToken = getTwitchToken() !== null;
    return {
        username: hasToken ? getTwitchUsername() : null,
        needsReauth: hasTwitchClientId() && isTwitchChatEnabled() && !hasToken && isTwitchAuthExpired(),
    };
}

/**
 * Live view of the Twitch sign-in for UI that needs to prompt a reconnect.
 * Refreshes on the auth-changed and settings-changed events the rest of the
 * Twitch code already dispatches.
 */
export function useTwitchAuthStatus(): TwitchAuthStatus {
    const [status, setStatus] = useState<TwitchAuthStatus>(readStatus);

    useEffect(() => {
        const handler = () => setStatus(readStatus());
        handler();
        window.addEventListener(TWITCH_AUTH_CHANGED_EVENT, handler);
        window.addEventListener('pokepelago_twitch_changed', handler);
        return () => {
            window.removeEventListener(TWITCH_AUTH_CHANGED_EVENT, handler);
            window.removeEventListener('pokepelago_twitch_changed', handler);
        };
    }, []);

    return status;
}
