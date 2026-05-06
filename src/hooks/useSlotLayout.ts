// Pure layout math for absolute-positioned slot grids inside DexGrid region
// bodies. Replaces per-region CSS Grid `auto-fill` placement with JS-computed
// (x, y) transforms — the browser paints each slot at a known transform with
// no layout pass for the inner content. See
// [[2026-05-06 — Plan — JS-Driven DexGrid Slot Positioning]] in the vault for
// the full design rationale; this implementation scopes the refactor to the
// inner per-region grids only (the outer region-card grid stays in CSS, since
// laying out ~5 cards is cheap).
//
// Pure function — no React, no DOM. Tested in isolation in
// useSlotLayout.test.ts. The accompanying React hook
// (useSlotLayoutWithObserver) wires this up to a ResizeObserver.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface ComputeSlotLayoutInput {
    /** Number of slots to lay out. */
    count: number;
    /** Slot width and height in px (slots are square). */
    slotPx: number;
    /** Gap between adjacent slots, both axes. */
    gap: number;
    /** Inner width of the slot container (post-padding). */
    containerWidth: number;
}

export interface SlotPosition {
    x: number;
    y: number;
}

export interface ComputeSlotLayoutResult {
    /** Per-slot position, in input order. positions[i].x/.y for slot i. */
    positions: SlotPosition[];
    /** Total height of the slot block, ready for inline `height` on the
     *  positioning parent so the browser allocates the right scroll area. */
    totalHeight: number;
    /** How many slots fit in one row at the current container width. >= 1. */
    slotsPerRow: number;
}

/**
 * Compute per-slot (x, y) positions for an absolute-positioned uniform grid.
 *
 * Mirrors CSS `grid-template-columns: repeat(auto-fill, ${slotPx}px)` with a
 * `${gap}px` row+column gap, but without invoking the browser's layout engine
 * for the slots themselves. Total cost: O(count) integer math.
 *
 * Edge cases:
 *   - count = 0 → empty positions, totalHeight = 0, slotsPerRow = 1 (so
 *     callers can divide without guarding).
 *   - containerWidth < slotPx → slotsPerRow clamps to 1 (one column overflow
 *     is friendlier than zero-width division).
 *   - count > 0 but containerWidth = 0 → also clamps to 1; this happens during
 *     first paint before ResizeObserver fires. Caller should hide rendering
 *     until measured if it matters.
 */
export function computeSlotLayout(
    input: ComputeSlotLayoutInput,
): ComputeSlotLayoutResult {
    const { count, slotPx, gap, containerWidth } = input;

    if (count <= 0) {
        return { positions: [], totalHeight: 0, slotsPerRow: 1 };
    }

    // Slots-per-row mirrors `grid-template-columns: repeat(auto-fill, slotPx)`
    // with column gap: how many (slotPx + gap) chunks fit in (containerWidth + gap).
    // The +gap on numerator/denominator accounts for the trailing gap not being
    // present after the last cell.
    const slotsPerRow = Math.max(
        1,
        Math.floor((containerWidth + gap) / (slotPx + gap)),
    );

    const positions: SlotPosition[] = new Array(count);
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / slotsPerRow);
        const col = i % slotsPerRow;
        positions[i] = {
            x: col * (slotPx + gap),
            y: row * (slotPx + gap),
        };
    }

    const rowCount = Math.ceil(count / slotsPerRow);
    const totalHeight = rowCount * slotPx + (rowCount - 1) * gap;

    return { positions, totalHeight, slotsPerRow };
}

/**
 * React hook wrapper: measures container width via ResizeObserver, recomputes
 * layout when count / slotPx / gap / width change. Caller attaches the ref to
 * the positioning parent (the `position: relative` div whose width sets the
 * slot row capacity).
 *
 * Memoized so render cost is one O(count) pass per actual input change.
 */
export function useSlotLayout(
    count: number,
    slotPx: number,
    gap: number,
): { ref: React.RefObject<HTMLDivElement | null>; layout: ComputeSlotLayoutResult } {
    const ref = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Synchronous measure on mount so first paint uses the correct width
        // and we don't render at 0-width and then snap.
        const initialWidth = el.clientWidth;
        if (initialWidth !== containerWidth) setContainerWidth(initialWidth);

        // ResizeObserver catches sidebar toggles, font-load reflow, window
        // resize, and `display: none` flips of ancestor cards. rAF-coalesce so
        // a continuous sidebar drag doesn't trigger 60+ recomputes per second.
        let pending = false;
        let nextWidth = initialWidth;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const cbs = entry.contentBoxSize;
            // contentBoxSize is the standard; fall back to contentRect on
            // older Chromiums (shouldn't matter for modern Chrome but cheap).
            const w = Array.isArray(cbs) && cbs[0]
                ? cbs[0].inlineSize
                : entry.contentRect.width;
            nextWidth = w;
            if (!pending) {
                pending = true;
                requestAnimationFrame(() => {
                    pending = false;
                    setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
                });
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
        // containerWidth intentionally omitted: the observer reads the DOM and
        // calls setContainerWidth itself; including it would cause re-running
        // useLayoutEffect on every width change, which thrashes the observer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const layout = useMemo(
        () => computeSlotLayout({ count, slotPx, gap, containerWidth }),
        [count, slotPx, gap, containerWidth],
    );

    return { ref, layout };
}

/**
 * Per-element IntersectionObserver hook for virtualization. Returns whether
 * the observed element is currently in viewport (with the given root margin),
 * so a caller can skip rendering its (expensive) children when offscreen.
 *
 * Used by DexGrid to skip slot rendering for regions that aren't visible.
 * `rootMargin` defaults to a generous 600px overscan so a region just
 * below/above the fold is already populated before the user scrolls into it.
 */
export function useInViewport<T extends Element>(
    rootMargin: string = '600px 0px',
): { ref: React.RefObject<T | null>; inViewport: boolean } {
    const ref = useRef<T | null>(null);
    // Default to true: render-on-mount avoids a flash of empty wrapper before
    // the observer has fired, and is the safer choice if IntersectionObserver
    // is unsupported (older browsers).
    const [inViewport, setInViewport] = useState(true);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;
                setInViewport(entry.isIntersecting);
            },
            { rootMargin },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [rootMargin]);

    return { ref, inViewport };
}

