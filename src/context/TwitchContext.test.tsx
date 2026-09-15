// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const { channels, gameState } = vi.hoisted(() => ({
    channels: [] as FakeBroadcastChannel[],
    gameState: { connectedTeamSlot: null as { team: number; slot: number } | null, connectionKey: 'key-1' },
}));

class FakeBroadcastChannel {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    posted: unknown[] = [];
    closed = false;
    name: string;
    constructor(name: string) { this.name = name; channels.push(this); }
    postMessage(data: unknown) { this.posted.push(data); }
    close() { this.closed = true; }
    receive(data: unknown) { this.onmessage?.({ data }); }
}

vi.mock('./GameContext', () => ({ useGame: () => gameState }));

import { TwitchProvider, useTwitch } from './TwitchContext';

type TwitchApi = ReturnType<typeof useTwitch>;

const LB_KEY = 'pokepelago_team_0_slot_2_twitch_leaderboard';
const CREDITS_KEY = 'pokepelago_team_0_slot_2_twitch_credits';

describe('TwitchContext', () => {
    let container: HTMLDivElement;
    let root: Root;
    let api: TwitchApi;

    function Probe() {
        const value = useTwitch();
        useEffect(() => { api = value; });
        return null;
    }

    function render() {
        act(() => {
            root.render(createElement(TwitchProvider, null, createElement(Probe)));
        });
    }

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        channels.length = 0;
        gameState.connectedTeamSlot = { team: 0, slot: 2 };
        gameState.connectionKey = 'key-1';
        localStorage.clear();
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        container.remove();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('increments the leaderboard per viewer and records the credit', () => {
        render();
        act(() => {
            api.addGuess(25, 'Pikachu', 'Viewer', 'success');
            api.addGuess(1, 'Bulbasaur', 'Viewer', 'success');
            api.addGuess(4, 'Charmander', 'Other', 'success');
        });

        expect(api.leaderboard.get('Viewer')).toBe(2);
        expect(api.leaderboard.get('Other')).toBe(1);
        expect(api.getCredit(25)).toBe('Viewer');
        expect(api.getCredit(4)).toBe('Other');
        expect(api.guessFeed[0].pokemonName).toBe('Charmander');
    });

    it('credits a keyboard guess to You without touching the leaderboard', () => {
        render();
        act(() => { api.addGuess(25, 'Pikachu', null, 'success'); });

        expect(api.leaderboard.size).toBe(0);
        expect(api.getCredit(25)).toBe('You');
    });

    it('persists under the connected team and slot keys', () => {
        render();
        act(() => { api.addGuess(25, 'Pikachu', 'Viewer', 'success'); });

        expect(JSON.parse(localStorage.getItem(LB_KEY)!)).toEqual({ Viewer: 1 });
        expect(JSON.parse(localStorage.getItem(CREDITS_KEY)!)).toEqual({ 25: 'Viewer' });
    });

    it('reloads the stored leaderboard and credits for the slot on mount', () => {
        localStorage.setItem(LB_KEY, JSON.stringify({ Viewer: 7 }));
        localStorage.setItem(CREDITS_KEY, JSON.stringify({ 25: 'Viewer' }));
        render();

        expect(api.leaderboard.get('Viewer')).toBe(7);
        expect(api.getCredit(25)).toBe('Viewer');
        // The feed is session-only.
        expect(api.guessFeed).toEqual([]);
    });

    it('clears state when no slot is connected and stores nothing', () => {
        gameState.connectedTeamSlot = null;
        render();
        act(() => { api.addGuess(25, 'Pikachu', 'Viewer', 'success'); });

        expect(api.leaderboard.get('Viewer')).toBe(1);
        expect(localStorage.getItem(LB_KEY)).toBeNull();
    });

    it('broadcasts each guess to overlay tabs', () => {
        render();
        act(() => { api.addGuess(25, 'Pikachu', 'Viewer', 'success'); });

        const channel = channels[channels.length - 1];
        expect(channel.name).toBe('pokepelago_twitch');
        expect(channel.posted).toHaveLength(1);
        expect(channel.posted[0]).toMatchObject({
            type: 'guess', pokemonId: 25, pokemonName: 'Pikachu', username: 'Viewer', resultType: 'success',
        });
    });

    it('answers an overlay request-sync with the current state', () => {
        render();
        act(() => { api.addGuess(25, 'Pikachu', 'Viewer', 'success'); });

        const channel = channels[channels.length - 1];
        channel.posted.length = 0;
        act(() => { channel.receive({ type: 'request-sync' }); });

        expect(channel.posted).toHaveLength(1);
        const reply = channel.posted[0] as { type: string; leaderboard: [string, number][]; credits: [number, string][] };
        expect(reply.type).toBe('sync');
        expect(reply.leaderboard).toEqual([['Viewer', 1]]);
        expect(reply.credits).toEqual([[25, 'Viewer']]);
    });

    it('ignores malformed broadcast messages', () => {
        render();
        const channel = channels[channels.length - 1];
        channel.posted.length = 0;
        act(() => {
            channel.receive(null);
            channel.receive({ nope: true });
        });
        expect(channel.posted).toHaveLength(0);
    });
});
