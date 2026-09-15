// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTwitchAuthStatus, type TwitchAuthStatus } from './useTwitchAuthStatus';
import { clearTwitchAuth, expireTwitchAuth, storeTwitchToken, storeTwitchUsername } from '../services/twitchAuthService';

describe('useTwitchAuthStatus', () => {
    let container: HTMLDivElement;
    let root: Root;
    let status: TwitchAuthStatus;

    function Probe() {
        const value = useTwitchAuthStatus();
        useEffect(() => { status = value; });
        return null;
    }

    function render() {
        act(() => { root.render(createElement(Probe)); });
    }

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        localStorage.clear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        container.remove();
        localStorage.clear();
    });

    it('reports the connected login and no reconnect prompt', () => {
        localStorage.setItem('pokepelago_twitch_enabled', 'true');
        storeTwitchToken('abc123');
        storeTwitchUsername('streamer');
        render();

        expect(status.username).toBe('streamer');
        expect(status.needsReauth).toBe(false);
    });

    it('asks for a reconnect once the sign-in expires while chat guessing is on', () => {
        localStorage.setItem('pokepelago_twitch_enabled', 'true');
        storeTwitchToken('abc123');
        storeTwitchUsername('streamer');
        render();

        act(() => { expireTwitchAuth(); });

        expect(status.username).toBeNull();
        expect(status.needsReauth).toBe(true);
    });

    it('stays quiet when the user disconnected on purpose', () => {
        localStorage.setItem('pokepelago_twitch_enabled', 'true');
        storeTwitchToken('abc123');
        storeTwitchUsername('streamer');
        render();

        act(() => { clearTwitchAuth(); });

        expect(status.needsReauth).toBe(false);
    });

    it('stays quiet when chat guessing is switched off', () => {
        storeTwitchToken('abc123');
        storeTwitchUsername('streamer');
        render();

        act(() => { expireTwitchAuth(); });

        expect(status.needsReauth).toBe(false);
    });

    it('picks up the chat-guessing toggle event', () => {
        storeTwitchToken('abc123');
        storeTwitchUsername('streamer');
        render();
        act(() => { expireTwitchAuth(); });
        expect(status.needsReauth).toBe(false);

        act(() => {
            localStorage.setItem('pokepelago_twitch_enabled', 'true');
            window.dispatchEvent(new Event('pokepelago_twitch_changed'));
        });

        expect(status.needsReauth).toBe(true);
    });
});
