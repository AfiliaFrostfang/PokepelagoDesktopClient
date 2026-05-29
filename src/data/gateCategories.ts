/**
 * Effective gate classification (DEVEX-15).
 *
 * The APWorld now sends the exact gate classification it used in slot_data
 * (`gate_categories`), so the client gates identically to the *generating* server and
 * never drifts from its own bundled copy. This module turns that payload into the Sets
 * the gating logic uses.
 *
 * Backwards compatibility: seeds from a pre-0.6.2 APWorld don't send `gate_categories`.
 * For those, we reconstruct the *old* (pre-0.6.2) classification from the current bundled
 * sets minus the BUG-16 additions, so the client gates as leniently as that old server did
 * (rather than applying the corrected-but-stricter modern classification to a legacy seed).
 * Trigger is presence of the payload, never a version comparison.
 */
import {
    SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS,
    BABY_IDS, TRADE_EVO_IDS, FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS,
    STONE_EVO_IDS,
} from './pokemon_gates';

/** Shape of slot_data.gate_categories sent by the APWorld (DEVEX-15). */
export interface ServerGateCategories {
    legendary_sub: number[];
    legendary_box: number[];
    legendary_mythic: number[];
    baby: number[];
    trade_evo: number[];
    fossil: number[];
    ultra_beast: number[];
    paradox: number[];
    stone_evo: Record<string, number[]>;
}

/** The Sets the gating logic checks against. */
export interface EffectiveGates {
    subLegendary: Set<number>;
    boxLegendary: Set<number>;
    mythic: Set<number>;
    baby: Set<number>;
    tradeEvo: Set<number>;
    fossil: Set<number>;
    ultraBeast: Set<number>;
    paradox: Set<number>;
    stoneEvo: Record<string, Set<number>>;
}

// IDs added/moved in 0.6.2 (BUG-16), per tier. Used ONLY to reconstruct the pre-0.6.2
// classification for legacy seeds. If a future version changes classifications, that
// version's seeds will send gate_categories and bypass this entirely — this delta only
// ever needs to describe the 0.6.2 changes.
const DELTA = {
    subAdded: [772, 773, 1014, 1015, 1016, 1017],  // Type:Null, Silvally, Loyal Three, Ogerpon
    boxAdded: [789, 790],                           // Cosmog, Cosmoem
    mythicAdded: [489],                             // Phione moved sub -> mythic in 0.6.2
    ubAdded: [803, 804],                            // Poipole, Naganadel
    babyAdded: [848],                               // Toxel
    tradeAdded: [683, 685],                         // Aromatisse, Slurpuff
    // FOSSIL / PARADOX / STONE were unchanged in 0.6.2.
};

const without = (s: Set<number>, ids: number[]): Set<number> => {
    const r = new Set(s);
    for (const i of ids) r.delete(i);
    return r;
};
const withIds = (s: Set<number>, ids: number[]): Set<number> => {
    const r = new Set(s);
    for (const i of ids) r.add(i);
    return r;
};
const copyGroups = (g: Record<string, Set<number>>): Record<string, Set<number>> =>
    Object.fromEntries(Object.entries(g).map(([k, v]) => [k, new Set(v)]));

function fromServer(g: ServerGateCategories): EffectiveGates {
    return {
        subLegendary: new Set(g.legendary_sub),
        boxLegendary: new Set(g.legendary_box),
        mythic: new Set(g.legendary_mythic),
        baby: new Set(g.baby),
        tradeEvo: new Set(g.trade_evo),
        fossil: new Set(g.fossil),
        ultraBeast: new Set(g.ultra_beast),
        paradox: new Set(g.paradox),
        stoneEvo: Object.fromEntries(Object.entries(g.stone_evo).map(([k, v]) => [k, new Set(v)])),
    };
}

/** Reconstruct the pre-0.6.2 (old, lenient) classification from the bundled current sets. */
export function legacyGateFallback(): EffectiveGates {
    return {
        // 489 (Phione) was a sub-legendary before 0.6.2, so remove the new sub additions and add 489 back.
        subLegendary: withIds(without(SUB_LEGENDARY_IDS, DELTA.subAdded), DELTA.mythicAdded),
        boxLegendary: without(BOX_LEGENDARY_IDS, DELTA.boxAdded),
        mythic: without(MYTHIC_IDS, DELTA.mythicAdded),
        baby: without(BABY_IDS, DELTA.babyAdded),
        tradeEvo: without(TRADE_EVO_IDS, DELTA.tradeAdded),
        fossil: new Set(FOSSIL_IDS),
        ultraBeast: without(ULTRA_BEAST_IDS, DELTA.ubAdded),
        paradox: new Set(PARADOX_IDS),
        stoneEvo: copyGroups(STONE_EVO_IDS),
    };
}

/**
 * Build the effective gate sets. Uses the server's classification when present (every
 * 0.6.2+ seed sends it), otherwise the legacy fallback for older seeds.
 */
export function buildEffectiveGates(server: ServerGateCategories | null | undefined): EffectiveGates {
    return server ? fromServer(server) : legacyGateFallback();
}
