import type { CSSProperties } from 'react';
import { TYPE_COLORS } from './typeColors';
import pokemonMetadata from '../data/pokemon_metadata.json';

// Module-load precompute of the type-dot CSSProperties for every Pokemon. The
// previous inline IIFE in PokemonSlot ran on every render across 1025 slots.
// Moving it here means the work happens ONCE on import, and PokemonSlot just
// looks up by id.

export const TYPE_DOT_DEFAULT_STYLE: CSSProperties = {
    backgroundColor: '#4ade80',
    boxShadow: '0 0 4px #4ade80aa',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styleById: Record<number, CSSProperties> = {};
const titleById: Record<number, string> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = pokemonMetadata as Record<string, any>;
for (const [idStr, m] of Object.entries(meta)) {
    const id = Number(idStr);
    const types: string[] = m?.types ?? [];
    if (types.length === 0) continue;
    const cap1 = capitalize(types[0]);
    const cap2 = types[1] ? capitalize(types[1]) : '';
    const c1 = TYPE_COLORS[cap1] ?? '#4ade80';
    const c2 = cap2 ? (TYPE_COLORS[cap2] ?? c1) : c1;
    styleById[id] = types.length >= 2
        ? { background: `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`, boxShadow: `0 0 4px ${c1}aa` }
        : { backgroundColor: c1, boxShadow: `0 0 4px ${c1}aa` };
    titleById[id] = cap2 ? `${cap1} / ${cap2}` : cap1;
}

export function getTypeDotStyleForId(id: number): CSSProperties {
    return styleById[id] ?? TYPE_DOT_DEFAULT_STYLE;
}

export function getTypeTitleForId(id: number): string {
    return titleById[id] ?? '';
}
