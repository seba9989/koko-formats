/**
 * Schematy arktype dla wartości w sekcjach `[Koko …]`.
 *
 * Każdy czytnik zamienia surowy tekst z pliku na zmianę konfiguracji albo
 * zwraca `ArkErrors` (→ KK006 z opisem błędu w `message`). Tabele są typowane
 * przez mapowanie po kluczach, więc brak czytnika dla klucza to błąd kompilacji.
 *
 * Komunikaty arktype są po angielsku; własne (`ctx.mustBe`) — też, dla spójności.
 */
import { type } from 'arktype';
import type { ArkErrors } from 'arktype';
import {
  JOIN_MODES, KOKO_ASS_VERSION, KOKO_MAX_SPEED_RANGE, KOKO_SPEED_RANGE, KOKO_STYLE_MODES, NUMBERS_MODES,
  RAW_BOOL_VALUES, SERIES_LEXICON_NONE,
} from '../../types/index.js';
import type {
  BtInfoHashV2, KokoLektor, KokoLektorKey, KokoRules, KokoRulesKey, KokoStyleModifiers, KokoStyleParam, RawBool,
  Sha256,
} from '../../types/index.js';

/** Tekst z pliku → zmiana konfiguracji `T` albo błędy walidacji. */
export type ValueReader<T> = (value: string) => Partial<T> | ArkErrors;

// ─── Wartości podstawowe ────────────────────────────────────────────────────

/** Liczba w zapisie ze specyfikacji: `-12`, `0.5` (bez `1e3`, `.5`, `0x10`). */
export const decimal = type(/^-?\d+(?:\.\d+)?$/).pipe((s) => Number(s));

const nonNegative = decimal.to('number >= 0');
const between = ({ min, max }: { min: number; max: number }) => decimal.to(type.number.atLeast(min).atMost(max));

const nonEmpty = type('string > 0');
const lowercase = type('string').pipe((s) => s.toLowerCase());

/** `yes/no/true/false/1/0/tak/nie`, bez rozróżniania wielkości liter. */
const BOOL_WORDS = Object.keys(RAW_BOOL_VALUES) as RawBool[];
const bool = lowercase.to(type.enumerated(...BOOL_WORDS)).pipe((word) => RAW_BOOL_VALUES[word]);

/** Lista rozdzielona przecinkami; puste elementy pomijane. */
const list = type('string').pipe((s) => s.split(',').map((item) => item.trim()).filter(Boolean));

/** Wzorzec użytkownika (`SkipIfMatch`) — kompilowany w runtime z flagą `u`. */
const regexSource = type('string').narrow((source, ctx) => {
  try {
    new RegExp(source, 'u');
    return true;
  } catch {
    return ctx.mustBe('a valid regular expression (u flag)');
  }
});

// ─── [Script Info] ──────────────────────────────────────────────────────────

/** `KokoAnime Version` — liczba całkowita; wyższą od obsługiwanej zgłasza parser (KK002). */
export const KOKO_VERSION = decimal.to('number.integer');
export { KOKO_ASS_VERSION };

// ─── [Koko Lektor] ──────────────────────────────────────────────────────────

export const LEKTOR_VALUES: { [K in KokoLektorKey]: ValueReader<KokoLektor> } = {
  voice:       nonEmpty.pipe((voice) => ({ voice })),
  speed:       between(KOKO_SPEED_RANGE).pipe((speed) => ({ speed })),
  gain:        decimal.pipe((gain) => ({ gain })),
  duck:        decimal.to('number <= 0').pipe((duck) => ({ duck })),
  duckattack:  nonNegative.pipe((duckAttack) => ({ duckAttack })),
  duckrelease: nonNegative.pipe((duckRelease) => ({ duckRelease })),
  offset:      decimal.pipe((offset) => ({ offset })),
  mingap:      nonNegative.pipe((minGap) => ({ minGap })),
};

// ─── [Koko Rules] ───────────────────────────────────────────────────────────

export const RULES_VALUES: { [K in KokoRulesKey]: ValueReader<KokoRules> } = {
  readstyles:    list.pipe((readStyles) => ({ readStyles })),
  skipstyles:    list.pipe((skipStyles) => ({ skipStyles })),
  ignorenames:   list.pipe((ignoreNames) => ({ ignoreNames })),
  skipifeffect:  bool.pipe((skipIfEffect) => ({ skipIfEffect })),
  skipifnoactor: bool.pipe((skipIfNoActor) => ({ skipIfNoActor })),
  borrowgap:     bool.pipe((borrowGap) => ({ borrowGap })),
  skipifmatch:   regexSource.pipe((skipIfMatch) => ({ skipIfMatch })),
  numbers:       lowercase.to(type.enumerated(...NUMBERS_MODES)).pipe((numbers) => ({ numbers })),
  join:          lowercase.to(type.enumerated(...JOIN_MODES)).pipe((join) => ({ join })),
  joinmaxgap:    nonNegative.pipe((joinMaxGap) => ({ joinMaxGap })),
  maxdelay:      nonNegative.pipe((maxDelay) => ({ maxDelay })),
  maxspeed:      between(KOKO_MAX_SPEED_RANGE).pipe((maxSpeed) => ({ maxSpeed })),
  serieslexicon: nonEmpty.pipe((value) => ({
    seriesLexicon: value.toLowerCase() === SERIES_LEXICON_NONE
      ? ({ kind: 'none' } as const)
      : ({ kind: 'path', path: value } as const),
  })),
};

// ─── [Koko Styles] ──────────────────────────────────────────────────────────

export const STYLE_PARAM_VALUES: { [K in KokoStyleParam]: ValueReader<KokoStyleModifiers> } = {
  speed: decimal.to('number > 0').pipe((speed) => ({ speed })),
  gain:  decimal.pipe((gain) => ({ gain })),
  mode:  type.enumerated(...KOKO_STYLE_MODES).pipe((mode) => ({ mode })),
};

// ─── [Koko Sources] ─────────────────────────────────────────────────────────

const sha256 = type(/^sha256:[0-9a-f]{64}$/).as<Sha256>();

/** Pola wpisu źródła po tokenizacji `k=v`; wymagany `btih` lub `btmh`. */
export const SOURCE_FIELDS = type({
  'btih?': /^(?:[0-9a-fA-F]{40}|[A-Za-z2-7]{32})$/,
  'btmh?': type(/^1220[0-9a-fA-F]{64}$/).as<BtInfoHashV2>(),
  file: 'string > 0',
  size: decimal.to('number.integer > 0'),
  'name?': 'string',
  'fingerprint?': sha256,
}).narrow((source, ctx) => source.btih !== undefined || source.btmh !== undefined || ctx.mustBe('an entry with btih or btmh'));
