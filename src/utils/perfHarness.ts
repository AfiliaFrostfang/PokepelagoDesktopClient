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

// Long-task + INP tracking. PerformanceObserver entries arrive
// asynchronously; we accumulate counters and notify the overlay via emit().
let longTaskCount = 0;
let longTaskTotalMs = 0;
let longestTaskMs = 0;
let lastInpMs = 0;        // most recent interaction's input-to-next-paint
let worstInpMs = 0;       // session high-water mark
let observersStarted = false;

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
    startObservers();
    emit();
}

function startObservers(): void {
    if (observersStarted) return;
    observersStarted = true;
    if (typeof PerformanceObserver === 'undefined') return;

    // Long-task observer: any main-thread block >= 50 ms shows up here.
    // entryTypes 'longtask' is supported in Chrome and Edge; Firefox doesn't
    // implement it, so this counter stays at 0 there.
    try {
        const longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                longTaskCount++;
                longTaskTotalMs += entry.duration;
                if (entry.duration > longestTaskMs) longestTaskMs = entry.duration;
            }
            emit();
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch { /* not supported, no-op */ }

    // Event-timing observer for INP (interaction-to-next-paint). Only
    // entries with a non-zero interactionId are user-driven interactions
    // (clicks, keypresses, taps). durationThreshold filters out the cheap ones.
    try {
        const eventObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const e = entry as any;
                if (typeof e.interactionId === 'number' && e.interactionId !== 0) {
                    lastInpMs = e.duration;
                    if (e.duration > worstInpMs) worstInpMs = e.duration;
                }
            }
            emit();
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
    } catch { /* not supported, no-op */ }
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
    // Slots may have already mounted before the expected count was provided
    // (DexGrid pushes the count from a useEffect that fires after the slot
    // useEffects). Fire the sentinels here too so the markers don't stay at —.
    if (mountedSlotIds.size >= n && allSlotsMountedTime === 0) {
        allSlotsMountedTime = performance.now();
        samplePeakHeap();
    }
    if (loadedSlotIds.size >= n && allSpritesLoadedTime === 0) {
        allSpritesLoadedTime = performance.now();
        samplePeakHeap();
    }
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
    longTaskCount: number;          // main-thread blocks >= 50 ms
    longTaskTotalMs: number;
    longestTaskMs: number;
    lastInpMs: number;              // most recent interaction's INP
    worstInpMs: number;             // session high-water mark
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
        longTaskCount,
        longTaskTotalMs,
        longestTaskMs,
        lastInpMs,
        worstInpMs,
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
    longTaskCount = 0;
    longTaskTotalMs = 0;
    longestTaskMs = 0;
    lastInpMs = 0;
    worstInpMs = 0;
}
