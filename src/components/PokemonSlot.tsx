import React from 'react';
import clsx from 'clsx';
import type { PokemonRef } from '../types/pokemon';
import { usePokemonSlotContext } from '../context/PokemonSlotContext';
import { getCleanName } from '../utils/pokemon';
import pokemonNamesJson from '../data/pokemon_names.json';
import { TYPE_DOT_DEFAULT_STYLE, getTypeDotStyleForId, getTypeTitleForId } from '../utils/typeDotStyles';
import { PmdSpriteCanvas } from './PmdSpriteCanvas';
import { normalizePmdBaseUrl } from '../services/pmdSpriteService';
import { recordSlotMount, recordSlotRender, recordSpriteLoaded } from '../utils/perfHarness';

// Per-status border / shadow utility classes. Lookup table is a tiny but real
// win over the if/else chain that ran for every slot render.
const BORDER_CLASS_RELEASED = 'bg-blue-950/30 border-blue-800/30 opacity-40';
const BORDER_CLASS_CHECKED = 'bg-green-900/40 border-green-700/60';
const BORDER_CLASS_GUESSABLE = 'bg-emerald-950/80 border-green-500/70 shadow-[0_0_8px_rgba(34,197,94,0.35)]';
const BORDER_CLASS_SHADOW = 'bg-blue-950/30 border-blue-800/30 opacity-40';
const BORDER_CLASS_UNLOCKED = 'bg-gray-900/40 border-gray-700/40 opacity-35 grayscale';
const BORDER_CLASS_HINT = 'bg-indigo-950/40 border-indigo-900/40 opacity-60';
const BORDER_CLASS_LOCKED = 'bg-gray-800/60 border-gray-700/30';

interface PokemonSlotProps {
    pokemon: PokemonRef;
    status: 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint';
    isShiny?: boolean;
    order?: number;
    // PERF-02: per-pokemon state is computed by DexGrid and passed in as primitives
    // so PokemonSlot only needs to subscribe to the narrow PokemonSlotContext.
    // This unblocks React.memo (PERF-01) from skipping renders when unrelated game
    // state changes.
    canGuess: boolean;
    reason?: string;
    isReleased: boolean;
    isPokegeared: boolean;
    isDerpified: boolean;
    // PERF-12 (JS-driven slot positioning): when set, the slot renders as
    // `position: absolute; transform: translate(x, y)` inside a positioned
    // parent. Replaces the CSS-grid auto-fill placement: 150 slots per region
    // skip the browser's grid auto-placement pass entirely. `order` is ignored
    // in this mode — caller should pre-shuffle the input order. Opt-in via
    // ?jsDexGrid=1 in DexGrid.
    absolutePosition?: { x: number; y: number };
}

const PokemonSlotImpl: React.FC<PokemonSlotProps> = ({
    pokemon, status, isShiny = false, order,
    canGuess, reason, isReleased, isPokegeared, isDerpified,
    absolutePosition,
}) => {
    const { setSelectedPokemonId, acquireSlotSpriteUrl, releaseSlotSpriteUrl, peekSlotSpriteUrl, uiSettings, spriteRefreshCounter, pmdSpriteUrl, lang } = usePokemonSlotContext();

    // Perf harness counters (no-op when ?perf=1 is not set).
    recordSlotRender();
    React.useEffect(() => { recordSlotMount(pokemon.id); }, [pokemon.id]);

    // On (re)mount, hydrate from the cache synchronously if available so
    // toggling regions doesn't flash opacity-0 while the sprite re-resolves.
    // Lazy initializer so the peek runs once per mount, not per render.
    const [spriteUrl, setSpriteUrl] = React.useState<string | null>(
        () => peekSlotSpriteUrl(pokemon.id, { shiny: isShiny, derpyfied: isDerpified })
    );
    const [isLoaded, setIsLoaded] = React.useState(() => spriteUrl !== null);
    const [hasError, setHasError] = React.useState(false);
    const [hasHovered, setHasHovered] = React.useState(false);


    // PMD animated sprite state
    const normalizedPmdUrl = React.useMemo(
        () => pmdSpriteUrl ? normalizePmdBaseUrl(pmdSpriteUrl) : '',
        [pmdSpriteUrl]
    );
    const [playingAttack, setPlayingAttack] = React.useState(false);
    const [pmdError, setPmdError] = React.useState(false);
    const [idleFrameSize, setIdleFrameSize] = React.useState<number | null>(null);
    const prevStatusRef = React.useRef(status);

    // Trigger Attack animation when a Pokémon is first checked
    React.useEffect(() => {
        if (prevStatusRef.current !== 'checked' && status === 'checked' && normalizedPmdUrl) {
            setPlayingAttack(true);
            setPmdError(false);
        }
        prevStatusRef.current = status;
    }, [status, normalizedPmdUrl]);

    // Reset pmdError if the URL changes
    React.useEffect(() => {
        setPmdError(false);
        setPlayingAttack(false);
    }, [normalizedPmdUrl]);

    // Load sprite via the shared refcounted cache (services/spriteUrlCache.ts).
    // Acquire on mount + release on unmount: blob URLs survive remount, so
    // toggling a region (which unmounts every PokemonSlot in it via PERF-03)
    // no longer triggers a 150-blob revoke/recreate burst with the visible
    // opacity-0 flicker that Discord users were reporting. The cache is
    // evicted explicitly when spriteRefreshCounter changes (sprite-set toggle,
    // disconnect, debug refresh, shuffle trap).
    React.useEffect(() => {
        if (!uiSettings.enableSprites) {
            setSpriteUrl(null);
            setHasError(true);
            return;
        }

        let active = true;
        const { key, promise } = acquireSlotSpriteUrl(pokemon.id, {
            shiny: isShiny,
            derpyfied: isDerpified,
        });
        promise.then((url) => {
            if (active) {
                setSpriteUrl(url);
                if (!url) setHasError(true);
            }
        }).catch(() => {
            if (active) setHasError(true);
        });
        return () => {
            active = false;
            releaseSlotSpriteUrl(key);
        };
    }, [pokemon.id, isShiny, isDerpified, acquireSlotSpriteUrl, releaseSlotSpriteUrl, uiSettings.enableSprites, spriteRefreshCounter]);

    // Reset load state when the URL actually changes (e.g. derp flip swaps to
    // a different blob). Skip the first run so a cache-hydrated mount doesn't
    // clobber its own isLoaded=true initial state and re-introduce the
    // opacity-0 flash we just removed.
    const prevSpriteUrlRef = React.useRef(spriteUrl);
    React.useEffect(() => {
        if (prevSpriteUrlRef.current !== spriteUrl) {
            setIsLoaded(false);
            setHasError(false);
            prevSpriteUrlRef.current = spriteUrl;
        }
    }, [spriteUrl]);

    // Perf harness: report when this slot has reached a "settled" state for
    // sprite loading (loaded, errored, or sprites disabled). Dedup by id is
    // handled in the harness.
    React.useEffect(() => {
        if (!uiSettings.enableSprites || isLoaded || hasError) {
            recordSpriteLoaded(pokemon.id);
        }
    }, [pokemon.id, uiSettings.enableSprites, isLoaded, hasError]);

    const isChecked = status === 'checked';
    const isVisible = isChecked || status === 'shadow' || status === 'hint';
    const langNames = (pokemonNamesJson as Record<string, Record<string, string>>)[pokemon.id.toString()];
    const localName = lang !== 'global' && langNames?.[lang];
    const cleanName = localName || getCleanName(pokemon.name);

    const isReadyToGuess = !isChecked && canGuess;

    // Type-dot style + tooltip both come from a precomputed map (one pass over
    // pokemonMetadata at module load). Replaces a per-render IIFE that built
    // CSSProperties from scratch across 1025 slots.
    const typeDotStyle = uiSettings.typeDot
        ? getTypeDotStyleForId(pokemon.id)
        : TYPE_DOT_DEFAULT_STYLE;
    const typeTitle = getTypeTitleForId(pokemon.id);

    const borderClass =
        isReleased ? BORDER_CLASS_RELEASED :
        isChecked ? BORDER_CLASS_CHECKED :
        isReadyToGuess ? BORDER_CLASS_GUESSABLE :
        status === 'shadow' ? BORDER_CLASS_SHADOW :
        status === 'unlocked' ? BORDER_CLASS_UNLOCKED :
        status === 'hint' ? BORDER_CLASS_HINT :
        BORDER_CLASS_LOCKED;

    // FEAT-10: slot + sprite size is driven by uiSettings.spriteSize (1x / 2x / 4x).
    // Base = 44px (original w-11). Users with complaints about sprites being too small
    // can bump this. Text overlays (dex #, shiny sparkle) stay at their intrinsic size
    // so they remain legible at the corner of the larger slot without dominating it.
    const slotPx = 44 * uiSettings.spriteSize;

    // UI-01: "Who's That Pokémon?" silhouette. Unguessed/released/hinted slots get a
    // blacked-out sprite with a gentle indigo (themeable) halo — nod to the anime
    // reveal segment, tuned down so a 150-slot grid doesn't drown in aura. Pokegeared
    // slots keep the dimmed-but-colored look so the "I paid to peek" signal stays
    // distinct from a default silhouette.
    const isSilhouette = status === 'shadow' || status === 'hint' || isReleased;
    const silhouetteFilter = isSilhouette
        ? (isPokegeared
            ? 'brightness(0.5)'
            : (uiSettings.silhouetteGlow
                ? 'brightness(0) drop-shadow(0 0 2px var(--pp-silhouette-glow))'
                : 'brightness(0)'))
        : undefined;
    const silhouetteOpacity = isSilhouette ? (isPokegeared ? 0.8 : 0.85) : 1;

    return (
        <div
            onClick={() => setSelectedPokemonId(pokemon.id)}
            onMouseEnter={() => {
                if (!uiSettings.persistentDot && isReadyToGuess && !hasHovered) setHasHovered(true);
            }}
            className={clsx(
                // 2026-05-06: hover transition removed entirely. With 1025
                // slots each carrying transform/box-shadow transition watchers,
                // every paint frame the browser checks them all for changes.
                // Snap-hover (instant scale + shadow on :hover) trades a tiny
                // bit of visual polish for measurable style-recalc reduction
                // during sidebar toggle / region toggle.
                'flex items-center justify-center relative group cursor-pointer border',
                // Static styles moved from inline style obj to class — saves
                // per-slot inline style application across 1025 elements.
                // contain: layout scope-limits reflow within the slot.
                // [contain:layout] is Tailwind arbitrary syntax.
                '[contain:layout] [border-radius:var(--pp-slot-radius)]',
                borderClass,
                // In flow mode, Tailwind's `hover:scale-*` (which compiles to
                // the standalone `scale: N` property in v4) works fine because
                // there's no inline `transform: translate()` for it to
                // multiply against. In absolute mode (PERF-12), the standalone
                // `scale` property is applied AFTER the `transform` matrix
                // per CSS Transforms L2, so it scales the translate vector by
                // N — slots far down the page jump dramatically downward on
                // hover (visible bug 2026-05-06: #1023 jumps ~110px). We swap
                // to a CSS variable that composes inside the same `transform`
                // string, so scale and translate live in the same matrix
                // multiplication and the translate stays put.
                absolutePosition !== undefined
                    ? (isReadyToGuess
                        ? 'hover:[--slot-scale:1.1] active:[--slot-scale:0.95] hover:shadow-[0_0_14px_rgba(34,197,94,0.6)]'
                        : 'hover:[--slot-scale:1.05] active:[--slot-scale:0.95]')
                    : (isReadyToGuess
                        ? 'hover:scale-110 hover:shadow-[0_0_14px_rgba(34,197,94,0.6)] active:scale-95'
                        : 'hover:scale-105 active:scale-95'),
                isShiny && isChecked && 'shadow-[0_0_10px_rgba(255,215,0,0.4)]',
            )}
            style={{
                width: slotPx,
                height: slotPx,
                // JS-driven layout (PERF-12): take the slot out of flow,
                // position via composited transform. Trace 2026-05-06 showed
                // willChange:transform across 1025 slots was net-negative —
                // Chrome's compositor was allocating eager GPU layers and the
                // layout pass still had to walk each slot. transform alone is
                // composited; let Chrome's own promotion heuristic decide
                // when a slot deserves a layer.
                //
                // The `scale(var(--slot-scale, 1))` factor is part of the
                // same transform string so hover/active scale composes inside
                // a single matrix multiplication with the translate. Tailwind
                // `hover:[--slot-scale:1.1]` re-defines the variable on hover;
                // CSS `var()` resolution is dynamic, so the inline transform
                // recomputes without React having to track hover state.
                //
                // `contain: layout paint` upgrades the slot's existing
                // [contain:layout] Tailwind class with paint isolation too —
                // each slot is its own layout AND paint root, so when the
                // wrapper geometry changes Chrome can resolve each slot's
                // contribution in isolation. Size containment is intentionally
                // omitted (slots have explicit width/height inline; size
                // would be redundant and we saw `contain: strict` regress).
                ...(absolutePosition !== undefined
                    ? {
                          position: 'absolute' as const,
                          transform: `translate(${absolutePosition.x}px, ${absolutePosition.y}px) scale(var(--slot-scale, 1))`,
                          contain: 'layout paint',
                      }
                    : order !== undefined
                    ? { order }
                    : {}),
            }}
            title={!canGuess ? reason : (isChecked ? cleanName : status === 'hint' ? `${cleanName} (Hinted)` : `#${pokemon.id}`)}
        >
            {isVisible && normalizedPmdUrl && !pmdError && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible"
                    style={silhouetteFilter ? { filter: silhouetteFilter, opacity: silhouetteOpacity } : undefined}
                >
                    <PmdSpriteCanvas
                        id={pokemon.id}
                        baseUrl={normalizedPmdUrl}
                        anim={playingAttack ? 'Attack' : 'Idle'}
                        onAnimComplete={() => setPlayingAttack(false)}
                        onError={() => { setPmdError(true); setPlayingAttack(false); }}
                        onFrameSize={playingAttack ? undefined : setIdleFrameSize}
                        referenceFrameSize={playingAttack && idleFrameSize ? idleFrameSize : undefined}
                        size={slotPx}
                    />
                </div>
            )}

            {isVisible && !normalizedPmdUrl && !hasError && spriteUrl && (
                // DOM consolidation 2026-05-06: merged a wrapper <div> into the
                // <img>. The wrapper existed for centering, but the img is
                // exactly slot-sized via inline width/height, so centering was
                // a no-op. Saves one DOM node per visible slot — ~1000 nodes
                // for a fully-checked dex.
                <img
                    src={spriteUrl}
                    alt={isChecked ? pokemon.name : `Pokemon #${pokemon.id}`}
                    decoding="async"
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                    className={clsx(
                        'absolute inset-0 object-contain z-10 pointer-events-none transition-opacity duration-300',
                        isLoaded ? 'opacity-100' : 'opacity-0',
                    )}
                    style={{
                        imageRendering: 'pixelated',
                        width: slotPx,
                        height: slotPx,
                        ...(silhouetteFilter ? { filter: silhouetteFilter, opacity: isLoaded ? silhouetteOpacity : 0 } : {}),
                    }}
                />
            )}

            {uiSettings.showDexNumbers && (() => {
                const hasSpriteContent = isVisible && ((uiSettings.enableSprites && spriteUrl && !hasError) || (normalizedPmdUrl && !pmdError));
                const showLarge = !hasSpriteContent;
                return showLarge ? (
                    <span className="text-gray-500/80 font-mono font-bold z-10 pointer-events-none" style={{ fontSize: 11 * uiSettings.spriteSize }}>
                        #{pokemon.id}
                    </span>
                ) : (
                    <span className="absolute bottom-0.5 left-0.5 text-gray-500/60 font-mono z-10 pointer-events-none" style={{ fontSize: 10 * uiSettings.spriteSize }}>
                        #{pokemon.id}
                    </span>
                );
            })()}

            {/* Shiny sparkle indicator (single span — wrapper div removed) */}
            {isShiny && isChecked && (
                <span
                    className="absolute top-0.5 right-0.5 z-20 animate-pulse leading-none drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]"
                    style={{ fontSize: 10 * uiSettings.spriteSize }}
                >✨</span>
            )}

            {/* Guessable indicator — type-colored dot. Wrapper div removed: it
                conditionally renders/unrenders on hasHovered toggle (no fade
                between states), so the previous transition-opacity was dead. */}
            {isReadyToGuess && (uiSettings.persistentDot || !hasHovered) && (
                <span
                    className="absolute top-0.5 right-0.5 z-20 block rounded-full"
                    title={typeTitle}
                    style={{ ...typeDotStyle, width: 6 * uiSettings.spriteSize, height: 6 * uiSettings.spriteSize }}
                />
            )}

            {status === 'unlocked' && (
                <span className="text-yellow-700 font-bold opacity-40" style={{ fontSize: 18 * uiSettings.spriteSize }}>?</span>
            )}

            {status === 'locked' && (
                <span className="text-gray-700" style={{ fontSize: 10 * uiSettings.spriteSize }}>●</span>
            )}

            {/* Tooltip removed: the outer div already has title={cleanName}
                for checked slots, so the browser's native tooltip shows the
                same name on hover. The custom styled tooltip was duplicate
                DOM weight (one <div> per checked slot — hundreds in a played-
                through dex) and added paint cost on every hover. */}
        </div>
    );
};

// PERF-01 + PERF-02: React.memo with default shallow comparator. PokemonSlot now
// subscribes ONLY to the narrow PokemonSlotContext (uiSettings, sprite bundle,
// setSelectedPokemonId) via a memoized value, so unrelated game-state churn
// (catches, item receives, log appends, traps firing on other slots) no longer
// invalidates this slot's render. All per-pokemon state flows in as primitive
// props: `status`, `isShiny`, `order`, `canGuess`, `reason`, `isReleased`,
// `isPokegeared`, `isDerpified`. `pokemon` is stable via DexGrid's pokemonById
// memo map. Shallow comparator is correct for every prop here.
export const PokemonSlot = React.memo(PokemonSlotImpl);
