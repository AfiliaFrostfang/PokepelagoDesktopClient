/**
 * Regression fixture for the bundled gating data (BUG-16 classifications + BUG-17 badge
 * requirements). This guards the cross-repo "client matches the APWorld" contract at the
 * data layer: route_data.json (badgeRequirements) and pokemon_gates.ts are generated from
 * the APWorld's data.py, and if a future re-export drifts or is forgotten, these assertions
 * fail. Same philosophy as the DEVEX-16 item-decode regression block.
 *
 * The expected values come from the APWorld's authoritative computation
 * (route_data.compute_badge_requirement + data.py classification sets), verified live
 * against PokeAPI on 2026-05-29.
 */
import { describe, it, expect } from 'vitest';
import { BADGE_REQUIREMENTS, getBadgeRequirement } from './routeData';
import {
    SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS,
    BABY_IDS, TRADE_EVO_IDS, ULTRA_BEAST_IDS,
} from './pokemon_gates';

describe('BUG-17 badge requirements (must match the APWorld / Universal Tracker)', () => {
    // Cross-generation evolutions that previously diverged (client said guessable, UT said
    // out-of-logic). These are the exact mons from ChomperRex20's 2026-05-25 report.
    const cases: Array<[string, number, number]> = [
        ['Magnezone', 462, 3],
        ['Honchkrow', 430, 3],
        ['Perrserker', 863, 3],
        ['Electivire', 466, 6],
        ['Dusknoir', 477, 5],
        ['Bulbasaur', 1, 0],   // baseline: starter, no badge gate
    ];
    it.each(cases)('%s (#%i) requires %i badges', (_name, id, expected) => {
        expect(BADGE_REQUIREMENTS[String(id)] ?? 0).toBe(expected);
    });

    it('getBadgeRequirement reads the exported map (no recomputation)', () => {
        expect(getBadgeRequirement(462)).toBe(3);
        expect(getBadgeRequirement(1)).toBe(0);
    });
});

describe('BUG-16 gate classifications (must match data.py / PokeAPI)', () => {
    it('sub-legendaries include the synthetic + DLC legendaries', () => {
        for (const id of [772, 773, 1014, 1015, 1016, 1017]) {
            expect(SUB_LEGENDARY_IDS.has(id)).toBe(true);
        }
    });
    it('Cosmog line is box-tier', () => {
        expect(BOX_LEGENDARY_IDS.has(789)).toBe(true);
        expect(BOX_LEGENDARY_IDS.has(790)).toBe(true);
    });
    it('Phione is mythical, not sub-legendary', () => {
        expect(MYTHIC_IDS.has(489)).toBe(true);
        expect(SUB_LEGENDARY_IDS.has(489)).toBe(false);
    });
    it('Poipole and Naganadel are Ultra Beasts', () => {
        expect(ULTRA_BEAST_IDS.has(803)).toBe(true);
        expect(ULTRA_BEAST_IDS.has(804)).toBe(true);
    });
    it('Toxel is a baby', () => {
        expect(BABY_IDS.has(848)).toBe(true);
    });
    it('Aromatisse and Slurpuff are trade evolutions', () => {
        expect(TRADE_EVO_IDS.has(683)).toBe(true);
        expect(TRADE_EVO_IDS.has(685)).toBe(true);
    });
    it('a Pokemon is never in two legendary tiers', () => {
        for (const id of SUB_LEGENDARY_IDS) {
            expect(BOX_LEGENDARY_IDS.has(id)).toBe(false);
            expect(MYTHIC_IDS.has(id)).toBe(false);
        }
    });
});
