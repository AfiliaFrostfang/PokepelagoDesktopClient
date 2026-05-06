// Local benchmark harness for measuring DexGrid render perf.
//
// Activate with ?perf=1 in the URL. The harness:
//   - Records performance.now() at boot, dexgrid mount, all slots first-mounted,
//     all sprites loaded.
//   - Counts total slot render() invocations until "all sprites loaded" so
//     React.memo wins are visible (lower number = fewer wasted renders).
//   - Captures peak JS heap (Chrome only, performance.memory).
//   - Auto-opens all regions on DexGrid mount so each run is comparable.
//
// Used to A/B render-perf changes (className trim, lazy img loading, hoisted
// lang, precomputed typeDotStyle, etc.) without scope creep into the app.
//
// All operations are no-ops when perf mode is off, so this can ship behind
// the URL flag without affecting normal users.

let bootTime = 0;
let dexGridMountTime = 0;
let allSlotsMountedTime = 0;
let allSpritesLoadedTime = 0;

let expectedSlotCount = 0;
let mountedSlotIds = new Set<number>();
let loadedSlotIds = new Set<number>();
let totalRenderCount = 0;

let bootHeap = 0;
let peakHeap = 0;

const subscribers = new Set<() => void>();

function emit() {
    for (const fn of subscribers) fn();
}

export function isPerfMode(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('perf') === '1';
}

export function markBoot(): void {
    if (!isPerfMode()) return;
    bootTime = performance.now();
    bootHeap = readHeap();
    peakHeap = bootHeap;
    emit();
}

export function markDexGridMount(): void {
    if (!isPerfMode()) return;
    if (dexGridMountTime === 0) {
        dexGridMountTime = performance.now();
        samplePeakHeap();
        emit();
    }
}

export function setExpectedSlots(n: number): void {
    if (!isPerfMode()) return;
    expectedSlotCount = n;
    emit();
}

export function recordSlotMount(id: number): void {
    if (!isPerfMode()) return;
    if (mountedSlotIds.has(id)) return;
    mountedSlotIds.add(id);
    if (
        expectedSlotCount > 0
        && mountedSlotIds.size >= expectedSlotCount
        && allSlotsMountedTime === 0
    ) {
        allSlotsMountedTime = performance.now();
        samplePeakHeap();
    }
    emit();
}

export function recordSlotRender(): void {
    if (!isPerfMode()) return;
    totalRenderCount++;
    samplePeakHeap();
}

export function recordSpriteLoaded(id: number): void {
    if (!isPerfMode()) return;
    if (loadedSlotIds.has(id)) return;
    loadedSlotIds.add(id);
    if (
        expectedSlotCount > 0
        && loadedSlotIds.size >= expectedSlotCount
        && allSpritesLoadedTime === 0
    ) {
        allSpritesLoadedTime = performance.now();
        samplePeakHeap();
    }
    emit();
}

function samplePeakHeap(): void {
    const h = readHeap();
    if (h > peakHeap) peakHeap = h;
}

function readHeap(): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (performance as any).memory;
    return mem && typeof mem.usedJSHeapSize === 'number' ? mem.usedJSHeapSize : 0;
}

export interface PerfStats {
    bootMs: number;                 // 0 if not yet captured
    dexGridMountMs: number;         // ms from boot
    allSlotsMountedMs: number;      // ms from boot, 0 if not yet
    allSpritesLoadedMs: number;     // ms from boot, 0 if not yet
    totalRenderCount: number;
    expectedSlotCount: number;
    mountedSlotCount: number;
    loadedSlotCount: number;
    bootHeapMb: number;
    peakHeapMb: number;
}

export function getPerfStats(): PerfStats {
    return {
        bootMs: bootTime,
        dexGridMountMs: dexGridMountTime > 0 ? dexGridMountTime - bootTime : 0,
        allSlotsMountedMs: allSlotsMountedTime > 0 ? allSlotsMountedTime - bootTime : 0,
        allSpritesLoadedMs: allSpritesLoadedTime > 0 ? allSpritesLoadedTime - bootTime : 0,
        totalRenderCount,
        expectedSlotCount,
        mountedSlotCount: mountedSlotIds.size,
        loadedSlotCount: loadedSlotIds.size,
        bootHeapMb: bootHeap / 1024 / 1024,
        peakHeapMb: peakHeap / 1024 / 1024,
    };
}

export function subscribePerf(fn: () => void): () => void {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
}

// Test-only.
export function _resetPerfHarness(): void {
    bootTime = 0;
    dexGridMountTime = 0;
    allSlotsMountedTime = 0;
    allSpritesLoadedTime = 0;
    expectedSlotCount = 0;
    mountedSlotIds = new Set();
    loadedSlotIds = new Set();
    totalRenderCount = 0;
    bootHeap = 0;
    peakHeap = 0;
}
