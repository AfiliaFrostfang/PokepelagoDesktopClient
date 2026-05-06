import React from 'react';
import { isPerfMode, getPerfStats, subscribePerf, type PerfStats } from '../utils/perfHarness';

// Live readout for the ?perf=1 benchmark harness. Renders a fixed-position
// panel in the bottom-left corner with all the marks captured by perfHarness.
// Reads via subscription so updates land within ~16 ms instead of polling.

const fmt = (ms: number) => ms > 0 ? `${ms.toFixed(0)} ms` : '—';
const fmtMb = (mb: number) => mb > 0 ? `${mb.toFixed(1)} MB` : '—';

export const PerfOverlay: React.FC = () => {
    const [enabled] = React.useState(isPerfMode);
    const [stats, setStats] = React.useState<PerfStats | null>(null);

    React.useEffect(() => {
        if (!enabled) return;
        setStats(getPerfStats());
        const unsubscribe = subscribePerf(() => setStats(getPerfStats()));
        return unsubscribe;
    }, [enabled]);

    if (!enabled || !stats) return null;

    const expected = stats.expectedSlotCount || '—';

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 8,
                left: 8,
                zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.85)',
                color: '#fde68a',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.45,
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid #b45309',
                pointerEvents: 'none',
                userSelect: 'none',
                minWidth: 240,
            }}
            data-testid="perf-overlay"
        >
            <div style={{ color: '#fcd34d', fontWeight: 'bold', marginBottom: 4 }}>
                perf harness
            </div>
            <div>boot → dexgrid mount: {fmt(stats.dexGridMountMs)}</div>
            <div>boot → all slots mounted: {fmt(stats.allSlotsMountedMs)}</div>
            <div>boot → all sprites loaded: {fmt(stats.allSpritesLoadedMs)}</div>
            <div style={{ marginTop: 4 }}>
                slots mounted: {stats.mountedSlotCount} / {expected}
            </div>
            <div>sprites loaded: {stats.loadedSlotCount} / {expected}</div>
            <div>total renders: {stats.totalRenderCount}</div>
            <div style={{ marginTop: 4, color: '#fbbf24' }}>
                heap boot: {fmtMb(stats.bootHeapMb)}
            </div>
            <div style={{ color: '#fbbf24' }}>
                heap peak: {fmtMb(stats.peakHeapMb)}
            </div>
            <div style={{ marginTop: 4, color: '#fb923c' }}>
                long tasks: {stats.longTaskCount} ({stats.longTaskTotalMs.toFixed(0)} ms total)
            </div>
            <div style={{ color: '#fb923c' }}>
                longest task: {stats.longestTaskMs > 0 ? `${stats.longestTaskMs.toFixed(0)} ms` : '—'}
            </div>
            <div style={{ marginTop: 4, color: '#f87171' }}>
                INP last: {stats.lastInpMs > 0 ? `${stats.lastInpMs.toFixed(0)} ms` : '—'}
            </div>
            <div style={{ color: '#f87171' }}>
                INP worst: {stats.worstInpMs > 0 ? `${stats.worstInpMs.toFixed(0)} ms` : '—'}
            </div>
        </div>
    );
};
