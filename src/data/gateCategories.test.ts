/**
 * DEVEX-15: verify the effective-gates builder.
 * - When the server sends gate_categories, the client uses it verbatim.
 * - When absent (legacy seed), the fallback reconstructs the pre-0.6.2 (lenient)
 *   classification: the BUG-16 additions are removed and Phione is restored to sub.
 */
import { describe, it, expect } from 'vitest';
import { buildEffectiveGates, legacyGateFallback, type ServerGateCategories } from './gateCategories';

describe('legacy fallback (no gate_categories) reproduces pre-0.6.2 classification', () => {
    const g = legacyGateFallback();

    it('drops the 0.6.2 sub-legendary additions but keeps baseline sub-legendaries', () => {
        for (const id of [772, 773, 1014, 1015, 1016, 1017]) expect(g.subLegendary.has(id)).toBe(false);
        expect(g.subLegendary.has(144)).toBe(true);  // Articuno was always sub
    });
    it('restores Phione to sub-legendary and removes it from mythic', () => {
        expect(g.subLegendary.has(489)).toBe(true);
        expect(g.mythic.has(489)).toBe(false);
        expect(g.mythic.has(151)).toBe(true);  // Mew still mythic
    });
    it('drops the box-legendary additions', () => {
        expect(g.boxLegendary.has(789)).toBe(false);
        expect(g.boxLegendary.has(790)).toBe(false);
        expect(g.boxLegendary.has(150)).toBe(true);  // Mewtwo still box
    });
    it('drops the Ultra Beast, baby, and trade additions', () => {
        expect(g.ultraBeast.has(803)).toBe(false);
        expect(g.ultraBeast.has(804)).toBe(false);
        expect(g.ultraBeast.has(793)).toBe(true);  // Nihilego still UB
        expect(g.baby.has(848)).toBe(false);
        expect(g.baby.has(172)).toBe(true);        // Pichu still baby
        expect(g.tradeEvo.has(683)).toBe(false);
        expect(g.tradeEvo.has(685)).toBe(false);
        expect(g.tradeEvo.has(65)).toBe(true);     // Alakazam still trade
    });
    it('leaves fossil / paradox / stone unchanged', () => {
        expect(g.fossil.has(138)).toBe(true);
        expect(g.paradox.has(984)).toBe(true);
        expect(g.stoneEvo.fire.has(38)).toBe(true);
    });
});

describe('server-sent gate_categories are used verbatim', () => {
    it('builds sets directly from the payload', () => {
        const payload: ServerGateCategories = {
            legendary_sub: [773, 1017], legendary_box: [789], legendary_mythic: [489],
            baby: [848], trade_evo: [683], fossil: [138], ultra_beast: [803, 804],
            paradox: [984], stone_evo: { fire: [38] },
        };
        const g = buildEffectiveGates(payload);
        expect(g.subLegendary.has(773)).toBe(true);
        expect(g.mythic.has(489)).toBe(true);
        expect(g.ultraBeast.has(804)).toBe(true);
        expect(g.baby.has(848)).toBe(true);
        expect(g.stoneEvo.fire.has(38)).toBe(true);
        // Not in the payload → not present
        expect(g.subLegendary.has(144)).toBe(false);
    });
});
