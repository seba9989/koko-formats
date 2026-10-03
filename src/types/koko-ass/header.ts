/**
 * Zinterpretowane sekcje `[Koko Lektor]`, `[Koko Rules]`, `[Koko Styles]`
 * wraz z wartościami domyślnymi ze specyfikacji.
 */
import type { Db, Ms } from '../common.js';
import type { WildcardPattern } from './sections.js';

// ─── [Koko Lektor] ──────────────────────────────────────────────────────────

export interface KokoLektor {
  /** Voice pack Kokoro; `null` = z ustawień aplikacji. */
  voice: string | null;
  /** Bazowa prędkość, 0.5–2.0. */
  speed: number;
  /** Głośność lektora. */
  gain: Db;
  /** Ściszenie oryginału w czasie wypowiedzi (≤ 0). */
  duck: Db;
  duckAttack: Ms;
  duckRelease: Ms;
  /** Przesunięcie startu każdej wypowiedzi (może być < 0). */
  offset: Ms;
  /** Minimalna cisza między wypowiedziami. */
  minGap: Ms;
}

export const KOKO_LEKTOR_DEFAULTS = {
  voice: null,
  speed: 1.0,
  gain: 0,
  duck: -12,
  duckAttack: 150,
  duckRelease: 400,
  offset: 0,
  minGap: 80,
} as const satisfies KokoLektor;

/** Klucze `[Koko Lektor]` (małymi literami); inne → KK001. */
export const KOKO_LEKTOR_KEYS = [
  'voice', 'speed', 'gain', 'duck', 'duckattack', 'duckrelease', 'offset', 'mingap',
] as const satisfies readonly Lowercase<keyof KokoLektor>[];
export type KokoLektorKey = (typeof KOKO_LEKTOR_KEYS)[number];

/** Zakres dozwolonych wartości `Speed`. */
export const KOKO_SPEED_RANGE = { min: 0.5, max: 2.0 } as const;

// ─── [Koko Rules] ───────────────────────────────────────────────────────────

/** Wartości `Numbers` (bez rozróżniania wielkości liter). */
export const NUMBERS_MODES = ['no', 'auto'] as const;
export type NumbersMode = (typeof NUMBERS_MODES)[number];

/** Wartości `Join` (bez rozróżniania wielkości liter). */
export const JOIN_MODES = ['no', 'auto'] as const;
export type JoinMode = (typeof JOIN_MODES)[number];

/** Wartość `SeriesLexicon` wyłączająca leksykon serii. */
export const SERIES_LEXICON_NONE = 'none' as const;

/** `SeriesLexicon`: ścieżka względem `.ass` albo `none`. */
export type SeriesLexiconSetting =
  | { kind: 'path'; path: string }
  | { kind: 'none' };

export interface KokoRules {
  /** `null` = brak ustawienia (czytaj wszystkie style). Wzorce z rozróżnieniem wielkości liter. */
  readStyles: readonly WildcardPattern[] | null;
  skipStyles: readonly WildcardPattern[];
  skipIfEffect: boolean;
  skipIfNoActor: boolean;
  /** Źródło regexu (flaga `u`); `null` = brak. */
  skipIfMatch: string | null;
  numbers: NumbersMode;
  /** Wzorce pojedynczych wyrazów, **bez** rozróżniania wielkości liter. */
  ignoreNames: readonly WildcardPattern[];
  seriesLexicon: SeriesLexiconSetting;
  join: JoinMode;
  joinMaxGap: Ms;
  /** 1–3; `1` = bez przyspieszania. */
  maxSpeed: number;
  borrowGap: boolean;
  maxDelay: Ms;
}

export const KOKO_RULES_DEFAULTS = {
  readStyles: null,
  skipStyles: [],
  skipIfEffect: true,
  skipIfNoActor: false,
  skipIfMatch: null,
  numbers: 'no',
  ignoreNames: [],
  seriesLexicon: { kind: 'path', path: 'koko-lexicon.toml' },
  join: 'no',
  joinMaxGap: 50,
  maxSpeed: 1,
  borrowGap: true,
  maxDelay: 700,
} as const satisfies KokoRules;

/** Klucze `[Koko Rules]` (małymi literami); inne → KK001. */
export const KOKO_RULES_KEYS = [
  'readstyles', 'skipstyles', 'skipifeffect', 'skipifnoactor', 'skipifmatch', 'numbers',
  'ignorenames', 'serieslexicon', 'join', 'joinmaxgap', 'maxspeed', 'borrowgap', 'maxdelay',
] as const satisfies readonly Lowercase<keyof KokoRules>[];
export type KokoRulesKey = (typeof KOKO_RULES_KEYS)[number];

export const KOKO_MAX_SPEED_RANGE = { min: 1, max: 3 } as const;

// ─── [Koko Styles] ──────────────────────────────────────────────────────────

/** Etykieta stylu — w v1 bez wpływu na brzmienie. */
export type KokoStyleMode = 'speech' | 'thought' | 'flashback';

export const KOKO_STYLE_MODES = ['speech', 'thought', 'flashback'] as const satisfies readonly KokoStyleMode[];

/** Parametry w wartości `[Koko Styles]` (`k=v` rozdzielone spacjami); inne → KK001. */
export const KOKO_STYLE_PARAMS = ['speed', 'gain', 'mode'] as const;
export type KokoStyleParam = (typeof KOKO_STYLE_PARAMS)[number];

/** Wartość oznaczająca pominięcie stylu. */
export const KOKO_STYLE_SKIP = 'skip' as const;

/** `wzorzec = skip` */
export interface KokoStyleSkip {
  pattern: WildcardPattern;
  skip: true;
  line?: number;
}

/** `wzorzec = speed=… gain=… mode=…` */
export interface KokoStyleModifiers {
  pattern: WildcardPattern;
  skip: false;
  /** Mnożnik prędkości. */
  speed?: number;
  /** Dodawane dB. */
  gain?: Db;
  mode?: KokoStyleMode;
  line?: number;
}

export type KokoStyleRule = KokoStyleSkip | KokoStyleModifiers;

/** Reguły w kolejności z pliku — pierwszy pasujący wpis wygrywa. */
export type KokoStyles = KokoStyleRule[];
