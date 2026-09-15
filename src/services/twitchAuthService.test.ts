// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TWITCH_AUTH_CHANGED_EVENT,
    clearTwitchAuth,
    expireTwitchAuth,
    getTwitchAuthUrl,
    getTwitchClientId,
    getTwitchToken,
    getTwitchUsername,
    isTwitchAuthExpired,
    isTwitchChatEnabled,
    revalidateTwitchToken,
    storeTwitchToken,
    storeTwitchUsername,
    validateTwitchToken,
} from './twitchAuthService';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function okResponse(body: unknown): Response {
    return { ok: true, json: async () => body } as Response;
}

describe('twitchAuthService', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    let authChanged: number;
    const countAuthChanged = () => { authChanged += 1; };

    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        authChanged = 0;
        window.addEventListener(TWITCH_AUTH_CHANGED_EVENT, countAuthChanged);
    });

    afterEach(() => {
        window.removeEventListener(TWITCH_AUTH_CHANGED_EVENT, countAuthChanged);
        vi.unstubAllGlobals();
        vi.useRealTimers();
        localStorage.clear();
    });

    describe('token storage', () => {
        it('stores and reads a token back', () => {
            storeTwitchToken('abc123');
            expect(getTwitchToken()).toBe('abc123');
        });

        it('returns null when nothing is stored', () => {
            expect(getTwitchToken()).toBeNull();
            expect(isTwitchAuthExpired()).toBe(false);
        });

        it('keeps the token just under the four hour limit', () => {
            storeTwitchToken('abc123');
            vi.advanceTimersByTime(FOUR_HOURS_MS - 1000);
            expect(getTwitchToken()).toBe('abc123');
            expect(isTwitchAuthExpired()).toBe(false);
        });

        it('drops the token past four hours and marks it expired', () => {
            storeTwitchToken('abc123');
            storeTwitchUsername('streamer');
            vi.advanceTimersByTime(FOUR_HOURS_MS + 1000);

            expect(getTwitchToken()).toBeNull();
            expect(getTwitchUsername()).toBeNull();
            expect(isTwitchAuthExpired()).toBe(true);
            expect(authChanged).toBe(1);
        });

        it('clears the expired marker when a new token arrives', () => {
            storeTwitchToken('old');
            storeTwitchUsername('streamer');
            expireTwitchAuth();
            expect(isTwitchAuthExpired()).toBe(true);

            storeTwitchToken('fresh');
            expect(isTwitchAuthExpired()).toBe(false);
            expect(getTwitchToken()).toBe('fresh');
        });

        it('does not mark an expiry when there was no auth to lose', () => {
            expireTwitchAuth();
            expect(isTwitchAuthExpired()).toBe(false);
            expect(authChanged).toBe(1);
        });

        it('clearTwitchAuth wipes everything including the expired marker', () => {
            storeTwitchToken('abc123');
            storeTwitchUsername('streamer');
            expireTwitchAuth();

            clearTwitchAuth();

            expect(getTwitchToken()).toBeNull();
            expect(getTwitchUsername()).toBeNull();
            expect(isTwitchAuthExpired()).toBe(false);
        });

        it('reads the chat-enabled setting', () => {
            expect(isTwitchChatEnabled()).toBe(false);
            localStorage.setItem('pokepelago_twitch_enabled', 'true');
            expect(isTwitchChatEnabled()).toBe(true);
        });
    });

    describe('getTwitchAuthUrl', () => {
        it('derives the redirect from the current origin and path, and asks for chat scopes', () => {
            const url = new URL(getTwitchAuthUrl());

            expect(url.origin + url.pathname).toBe('https://id.twitch.tv/oauth2/authorize');
            expect(url.searchParams.get('client_id')).toBe(getTwitchClientId());
            expect(url.searchParams.get('response_type')).toBe('token');
            expect(url.searchParams.get('scope')).toBe('chat:read chat:edit');
            expect(url.searchParams.get('redirect_uri'))
                .toBe(window.location.origin + window.location.pathname);
        });
    });

    describe('validateTwitchToken', () => {
        it('returns the payload and sends the OAuth header', async () => {
            fetchMock.mockResolvedValue(okResponse({ login: 'streamer', user_id: '42', scopes: ['chat:read'] }));

            const result = await validateTwitchToken('abc123');

            expect(result).toEqual({ login: 'streamer', user_id: '42', scopes: ['chat:read'] });
            expect(fetchMock).toHaveBeenCalledWith(
                'https://id.twitch.tv/oauth2/validate',
                { headers: { Authorization: 'OAuth abc123' } },
            );
        });

        it('returns null on a non-ok response', async () => {
            fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
            await expect(validateTwitchToken('abc123')).resolves.toBeNull();
        });

        it('returns null when the request throws', async () => {
            fetchMock.mockRejectedValue(new Error('offline'));
            await expect(validateTwitchToken('abc123')).resolves.toBeNull();
        });
    });

    describe('revalidateTwitchToken', () => {
        it('is false without a stored token and never calls Twitch', async () => {
            await expect(revalidateTwitchToken()).resolves.toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('keeps a valid token and records the login', async () => {
            storeTwitchToken('abc123');
            fetchMock.mockResolvedValue(okResponse({ login: 'streamer', user_id: '42', scopes: [] }));

            await expect(revalidateTwitchToken()).resolves.toBe(true);

            expect(getTwitchToken()).toBe('abc123');
            expect(getTwitchUsername()).toBe('streamer');
            expect(isTwitchAuthExpired()).toBe(false);
        });

        it('clears the auth and flags an expiry when Twitch rejects the token', async () => {
            storeTwitchToken('abc123');
            storeTwitchUsername('streamer');
            fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);

            await expect(revalidateTwitchToken()).resolves.toBe(false);

            expect(getTwitchToken()).toBeNull();
            expect(getTwitchUsername()).toBeNull();
            expect(isTwitchAuthExpired()).toBe(true);
            expect(authChanged).toBeGreaterThan(0);
        });
    });
});
