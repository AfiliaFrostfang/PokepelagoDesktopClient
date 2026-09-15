// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const { FakeClient, clients, showToast, addGuess, attemptGuess, revalidateTwitchToken } = vi.hoisted(() => {
    type MessageHandler = (channel: string, tags: Record<string, string>, message: string, self: boolean) => void;

    const clients: FakeClientType[] = [];

    class FakeClientType {
        handlers = new Map<string, ((...args: unknown[]) => void)[]>();
        say = vi.fn(() => Promise.resolve([''] as [string]));
        connect = vi.fn(() => Promise.resolve(['', 0] as [string, number]));
        disconnect = vi.fn(() => Promise.resolve(['', 0] as [string, number]));
        removeAllListeners = vi.fn();
        options: unknown;
        constructor(options: unknown) { this.options = options; clients.push(this); }
        on(event: string, handler: (...args: unknown[]) => void) {
            const list = this.handlers.get(event) ?? [];
            list.push(handler);
            this.handlers.set(event, list);
        }
        emitMessage(username: string, message: string) {
            for (const handler of this.handlers.get('message') ?? []) {
                (handler as unknown as MessageHandler)('#chan', { 'display-name': username }, message, false);
            }
        }
    }

    return {
        FakeClient: FakeClientType,
        clients,
        showToast: vi.fn(),
        addGuess: vi.fn(),
        attemptGuess: vi.fn(),
        revalidateTwitchToken: vi.fn(() => Promise.resolve(true)),
    };
});

vi.mock('tmi.js', () => ({ default: { Client: FakeClient } }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ showToast }) }));
vi.mock('../context/TwitchContext', () => ({ useTwitch: () => ({ addGuess }) }));
vi.mock('./useGuessEngine', () => ({ useGuessEngine: () => ({ attemptGuess }) }));
vi.mock('../services/twitchAuthService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/twitchAuthService')>()),
    revalidateTwitchToken,
}));

import { useTwitchChat } from './useTwitchChat';

declare global {
    // eslint-disable-next-line no-var
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function Harness() {
    useTwitchChat({ enabled: true, channelName: 'chan', selectedLanguage: 'en' });
    return null;
}

describe('useTwitchChat', () => {
    let container: HTMLDivElement;
    let root: Root;

    function render() {
        act(() => { root.render(createElement(Harness)); });
        return clients[clients.length - 1];
    }

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        clients.length = 0;
        showToast.mockClear();
        addGuess.mockClear();
        attemptGuess.mockReset();
        revalidateTwitchToken.mockClear();
        attemptGuess.mockReturnValue({ type: 'success', pokemonId: 25, pokemonName: 'Pikachu' });
        localStorage.clear();
        localStorage.setItem('pokepelago_twitch_oauth_token', 'abc123');
        localStorage.setItem('pokepelago_twitch_oauth_token_ts', String(Date.now()));
        localStorage.setItem('pokepelago_twitch_oauth_username', 'streamer');
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        container.remove();
        vi.useRealTimers();
        localStorage.clear();
    });

    it('connects with the stored credentials to the normalised channel', () => {
        const client = render();
        const options = client.options as { channels: string[]; identity?: { username: string; password: string } };
        expect(options.channels).toEqual(['chan']);
        expect(options.identity).toEqual({ username: 'streamer', password: 'oauth:abc123' });
        expect(client.connect).toHaveBeenCalled();
    });

    it('turns a !guess into a guess attempt and credits the viewer', () => {
        const client = render();
        act(() => { client.emitMessage('Viewer', '!guess pikachu'); });

        expect(attemptGuess).toHaveBeenCalledWith('pikachu');
        expect(addGuess).toHaveBeenCalledWith(25, 'Pikachu', 'Viewer', 'success');
        expect(showToast).toHaveBeenCalledWith('success', '✓ Pikachu - guessed by @Viewer');
    });

    it('ignores messages that are not !guess commands', () => {
        const client = render();
        act(() => {
            client.emitMessage('Viewer', 'pikachu');
            client.emitMessage('Viewer', '!guessing game');
            client.emitMessage('Viewer', '!guess   ');
        });
        expect(attemptGuess).not.toHaveBeenCalled();
    });

    it('rate limits a viewer to one guess per five seconds', () => {
        const client = render();

        act(() => { client.emitMessage('Viewer', '!guess pikachu'); });
        act(() => { vi.advanceTimersByTime(4_000); });
        act(() => { client.emitMessage('Viewer', '!guess bulbasaur'); });
        expect(attemptGuess).toHaveBeenCalledTimes(1);

        // A different viewer is not affected by someone else's cooldown.
        act(() => { client.emitMessage('Other', '!guess bulbasaur'); });
        expect(attemptGuess).toHaveBeenCalledTimes(2);

        act(() => { vi.advanceTimersByTime(2_000); });
        act(() => { client.emitMessage('Viewer', '!guess bulbasaur'); });
        expect(attemptGuess).toHaveBeenCalledTimes(3);
    });

    it('posts a confirmation to chat when chat feedback is on', () => {
        const client = render();
        act(() => { client.emitMessage('Viewer', '!guess pikachu'); });
        expect(client.say).toHaveBeenCalledWith('chan', '✓ Pikachu guessed by @Viewer!');
    });

    it('posts nothing to chat when chat feedback is off', () => {
        localStorage.setItem('pokepelago_twitch_chat_feedback', 'false');
        const client = render();
        act(() => { client.emitMessage('Viewer', '!guess pikachu'); });

        expect(addGuess).toHaveBeenCalled();
        expect(client.say).not.toHaveBeenCalled();
    });

    it('re-validates the token once an hour while connected', () => {
        render();
        expect(revalidateTwitchToken).not.toHaveBeenCalled();

        act(() => { vi.advanceTimersByTime(60 * 60 * 1000); });
        expect(revalidateTwitchToken).toHaveBeenCalledTimes(1);

        act(() => { vi.advanceTimersByTime(60 * 60 * 1000); });
        expect(revalidateTwitchToken).toHaveBeenCalledTimes(2);
    });

    it('skips the hourly check while the tab is hidden and runs it on return', () => {
        render();
        const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

        act(() => { vi.advanceTimersByTime(60 * 60 * 1000); });
        expect(revalidateTwitchToken).not.toHaveBeenCalled();

        visibility.mockReturnValue('visible');
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(revalidateTwitchToken).toHaveBeenCalledTimes(1);

        visibility.mockRestore();
    });

    it('stops re-validating once the token is gone', () => {
        render();
        act(() => {
            localStorage.removeItem('pokepelago_twitch_oauth_token');
            window.dispatchEvent(new Event('pokepelago_twitch_auth_changed'));
        });

        act(() => { vi.advanceTimersByTime(3 * 60 * 60 * 1000); });
        expect(revalidateTwitchToken).not.toHaveBeenCalled();
    });

    it('does not post a second confirmation inside the chat cooldown', () => {
        const client = render();
        act(() => { client.emitMessage('One', '!guess pikachu'); });
        act(() => { client.emitMessage('Two', '!guess pikachu'); });

        expect(addGuess).toHaveBeenCalledTimes(2);
        expect(client.say).toHaveBeenCalledTimes(1);
    });
});
