// Refcounted blob-URL cache for PokemonSlot sprites.
//
// Why this exists: PERF-03 unmounts collapsed region bodies, so toggling a
// region remounts ~150 PokemonSlot instances. The pre-cache flow had each
// slot's effect fire createObjectURL(blob) on mount and revokeObjectURL on
// unmount, so a single region toggle ran 150 IDB reads + 150 blob creates +
// 150 revokes. Each new <img> started at opacity-0 until onLoad fired, so the
// user saw sprites visibly drop and re-appear. Reported by Discord users
// 2026-05+; root-caused 2026-05-06.
//
// This cache lets PokemonSlot acquire a stable URL synchronously after the
// first resolution per (id, options) key. URLs survive remount; refcount is
// purely diagnostic. Eviction is explicit -- callers bump
// spriteRefreshCounter when the underlying source changes (sprite set,
// disconnect, manual refresh) and useSpriteManager calls evictAllSpriteUrls
// in response.

interface Entry {
    promise: Promise<string | null>;
    url: string | null;
    refcount: number;
    createdAt: number;
}

const cache = new Map<string, Entry>();

const stats = {
    hits: 0,
    misses: 0,
    acquires: 0,
    releases: 0,
    evictions: 0,
};

export interface SpriteUrlCacheStats {
    size: number;
    hits: number;
    misses: number;
    acquires: number;
    releases: number;
    evictions: number;
    blobUrlCount: number;
    inFlightCount: number;
    activeRefs: number;
    cacheKeys?: Array<{ key: string; refcount: number; isBlob: boolean }>;
}

export interface SpriteUrlCacheKeyOptions {
    shiny?: boolean;
    animated?: boolean;
    derpyfied?: boolean;
}

export function spriteUrlCacheKey(
    id: number,
    options: SpriteUrlCacheKeyOptions,
): string {
    const parts: (string | number)[] = [id];
    if (options.shiny) parts.push('s');
    if (options.animated) parts.push('a');
    if (options.derpyfied) parts.push('d');
    return parts.join('_');
}

export function acquireSpriteUrl(
    key: string,
    factory: () => Promise<string | null>,
): Promise<string | null> {
    stats.acquires++;
    const existing = cache.get(key);
    if (existing) {
        stats.hits++;
        existing.refcount++;
        return existing.promise;
    }
    stats.misses++;
    const promise = factory().then((url) => {
        const entry = cache.get(key);
        if (entry) entry.url = url;
        return url;
    }).catch((err) => {
        // Drop failed entries so a retry can re-attempt.
        cache.delete(key);
        throw err;
    });
    cache.set(key, {
        promise,
        url: null,
        refcount: 1,
        createdAt: Date.now(),
    });
    return promise;
}

export function releaseSpriteUrl(key: string): void {
    stats.releases++;
    const entry = cache.get(key);
    if (entry && entry.refcount > 0) entry.refcount--;
}

// Synchronous peek. Returns the resolved URL if the entry is fully resolved,
// or null otherwise (entry missing OR still in-flight OR resolved-to-null).
// PokemonSlot uses this to hydrate state.spriteUrl on remount without an
// opacity-0 flash, which is the whole point of the cache for the
// region-toggle case.
export function peekSpriteUrl(key: string): string | null {
    const entry = cache.get(key);
    return entry ? entry.url : null;
}

export function evictAllSpriteUrls(): void {
    for (const entry of cache.values()) {
        if (entry.url && entry.url.startsWith('blob:')) {
            URL.revokeObjectURL(entry.url);
        }
        stats.evictions++;
    }
    cache.clear();
}

export function getSpriteUrlCacheStats(includeKeys = false): SpriteUrlCacheStats {
    let blobUrlCount = 0;
    let inFlightCount = 0;
    let activeRefs = 0;
    const cacheKeys: Array<{ key: string; refcount: number; isBlob: boolean }> = [];
    for (const [key, entry] of cache.entries()) {
        if (entry.url === null) inFlightCount++;
        else if (entry.url.startsWith('blob:')) blobUrlCount++;
        activeRefs += entry.refcount;
        if (includeKeys) {
            cacheKeys.push({
                key,
                refcount: entry.refcount,
                isBlob: entry.url ? entry.url.startsWith('blob:') : false,
            });
        }
    }
    return {
        size: cache.size,
        hits: stats.hits,
        misses: stats.misses,
        acquires: stats.acquires,
        releases: stats.releases,
        evictions: stats.evictions,
        blobUrlCount,
        inFlightCount,
        activeRefs,
        ...(includeKeys ? { cacheKeys } : {}),
    };
}

// Test-only.
export function _resetSpriteUrlCache(): void {
    evictAllSpriteUrls();
    stats.hits = 0;
    stats.misses = 0;
    stats.acquires = 0;
    stats.releases = 0;
    stats.evictions = 0;
}
