import { describe, it, expect } from 'vitest';
import { computeSlotLayout } from './useSlotLayout';

describe('computeSlotLayout', () => {
    it('returns empty layout for count=0', () => {
        const r = computeSlotLayout({ count: 0, slotPx: 44, gap: 4, containerWidth: 500 });
        expect(r.positions).toEqual([]);
        expect(r.totalHeight).toBe(0);
        // slotsPerRow defaults to 1 so callers can divide safely.
        expect(r.slotsPerRow).toBe(1);
    });

    it('lays out a single slot at (0, 0)', () => {
        const r = computeSlotLayout({ count: 1, slotPx: 44, gap: 4, containerWidth: 500 });
        expect(r.positions).toEqual([{ x: 0, y: 0 }]);
        expect(r.totalHeight).toBe(44);
    });

    it('matches CSS auto-fill: floor((width + gap) / (slot + gap))', () => {
        // 500 wide, 44 slot, 4 gap → floor((500 + 4) / 48) = floor(10.5) = 10.
        const r = computeSlotLayout({ count: 100, slotPx: 44, gap: 4, containerWidth: 500 });
        expect(r.slotsPerRow).toBe(10);
    });

    it('places slots in row-major order with gap between them', () => {
        const r = computeSlotLayout({ count: 5, slotPx: 44, gap: 4, containerWidth: 200 });
        // 200 wide, 44 slot, 4 gap → floor((200 + 4) / 48) = floor(4.25) = 4 per row.
        expect(r.slotsPerRow).toBe(4);
        expect(r.positions[0]).toEqual({ x: 0, y: 0 });
        expect(r.positions[1]).toEqual({ x: 48, y: 0 });
        expect(r.positions[2]).toEqual({ x: 96, y: 0 });
        expect(r.positions[3]).toEqual({ x: 144, y: 0 });
        // Slot 5 wraps to row 2.
        expect(r.positions[4]).toEqual({ x: 0, y: 48 });
    });

    it('totalHeight sums full rows + gaps between them, not after last row', () => {
        // 8 slots, 4 per row → 2 rows. Height = 2*44 + 1*4 = 92.
        const r = computeSlotLayout({ count: 8, slotPx: 44, gap: 4, containerWidth: 200 });
        expect(r.totalHeight).toBe(92);
    });

    it('partial trailing row counts toward height', () => {
        // 5 slots, 4 per row → 2 rows (one full, one with 1 slot). Height = 2*44 + 1*4 = 92.
        const r = computeSlotLayout({ count: 5, slotPx: 44, gap: 4, containerWidth: 200 });
        expect(r.totalHeight).toBe(92);
    });

    it('clamps slotsPerRow to 1 when container is narrower than a slot', () => {
        // containerWidth too small for one slot — still emit 1 column rather
        // than zero-divide. Slots overflow visually; that's the caller's
        // problem (typically: hide rendering until measured).
        const r = computeSlotLayout({ count: 3, slotPx: 44, gap: 4, containerWidth: 20 });
        expect(r.slotsPerRow).toBe(1);
        expect(r.positions[0]).toEqual({ x: 0, y: 0 });
        expect(r.positions[1]).toEqual({ x: 0, y: 48 });
        expect(r.positions[2]).toEqual({ x: 0, y: 96 });
        expect(r.totalHeight).toBe(3 * 44 + 2 * 4);
    });

    it('clamps slotsPerRow to 1 when container width is exactly 0 (pre-measure)', () => {
        const r = computeSlotLayout({ count: 2, slotPx: 44, gap: 4, containerWidth: 0 });
        expect(r.slotsPerRow).toBe(1);
        expect(r.positions[1]).toEqual({ x: 0, y: 48 });
    });

    it('handles realistic Pokepelago region: 151 Kanto slots @ 1x sprite size', () => {
        // 1x sprite size: slotPx = 44, gap = 4 (sm:gap-1.5 = 6, but 4 is the
        // base gap-1). Container width: typical region card body at 5-region
        // layout = ~280px inner.
        const r = computeSlotLayout({ count: 151, slotPx: 44, gap: 4, containerWidth: 280 });
        // floor((280 + 4) / 48) = floor(5.916...) = 5.
        expect(r.slotsPerRow).toBe(5);
        // 151 slots / 5 per row = 31 rows (30 full + 1 partial).
        // Height = 31*44 + 30*4 = 1364 + 120 = 1484.
        expect(r.totalHeight).toBe(31 * 44 + 30 * 4);
        expect(r.positions.length).toBe(151);
        // Last slot: index 150 → row 30, col 0.
        expect(r.positions[150]).toEqual({ x: 0, y: 30 * 48 });
    });

    it('handles 2x sprite size: slotPx=88', () => {
        // 2x: slotPx = 88. Same gap. Wider slots = fewer per row.
        const r = computeSlotLayout({ count: 20, slotPx: 88, gap: 4, containerWidth: 500 });
        // floor((500 + 4) / 92) = floor(5.478) = 5.
        expect(r.slotsPerRow).toBe(5);
        expect(r.positions[0]).toEqual({ x: 0, y: 0 });
        expect(r.positions[5]).toEqual({ x: 0, y: 92 });
    });

    it('cost is O(count) — 1025 slots resolves quickly enough for hot path', () => {
        // Smoke check: 1025 slots (full dex worst case) computes in well under
        // 5ms even on slow hardware. We don't assert wall-clock in tests
        // (flaky), but we exercise the loop and verify structure.
        const r = computeSlotLayout({ count: 1025, slotPx: 44, gap: 4, containerWidth: 280 });
        expect(r.positions.length).toBe(1025);
        // Assert spot-checked positions match the row-major formula.
        const spr = r.slotsPerRow;
        for (const i of [0, 1, spr - 1, spr, spr * 5, 1024]) {
            const expectedRow = Math.floor(i / spr);
            const expectedCol = i % spr;
            expect(r.positions[i]).toEqual({
                x: expectedCol * (44 + 4),
                y: expectedRow * (44 + 4),
            });
        }
    });
});
