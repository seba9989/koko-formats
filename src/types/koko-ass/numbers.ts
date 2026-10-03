/**
 * Rozwijanie liczb (`Numbers = auto`, Koko-ASS §4.3).
 * Reguły są deterministyczne — wynik wchodzi do klucza wypowiedzi w Koko-Pack.
 */

/** Wersja reguł liczb; trafia do klucza Koko-Pack (pole `numbers`). */
export const NUMBER_RULES_VERSION = 1 as const;
export type NumberRulesVersion = typeof NUMBER_RULES_VERSION;

/** Przypadki używane przez reguły (biernik tylko dla godzin po „na”). */
export type GrammaticalCase =
  | 'nominative'
  | 'genitive'
  | 'dative'
  | 'accusative'
  | 'instrumental'
  | 'locative';

export type GrammaticalGender = 'masculine' | 'feminine';

/** Wzorce z tabeli 4.3.2, w kolejności sprawdzania. */
export type NumberPattern =
  | 'glued' //         1. cyfry sklejone z literą (S2, 1080p) — bez zmian, KK202
  | 'range' //         2. zakres (3-4, 3–4) — bez zmian, KK202
  | 'time' //          3. H:MM / HH:MM
  | 'yearMarker' //    4. rok + `r.` / `roku`
  | 'yearAfterWord' // 5. `rok` / `roku` + rok
  | 'ordinal' //       6. cyfry + kropka + spacja + mała litera
  | 'percent' //       7. liczba + %
  | 'currency' //      8. kwota z walutą
  | 'cardinal'; //     9. każda inna liczba

export const NUMBER_PATTERN_ORDER = [
  'glued',
  'range',
  'time',
  'yearMarker',
  'yearAfterWord',
  'ordinal',
  'percent',
  'currency',
  'cardinal',
] as const satisfies readonly NumberPattern[];

/** Waluty z tabeli 4.3.6 (kod kanoniczny). */
export type Currency = 'PLN' | 'JPY' | 'USD' | 'EUR';

/** Zapisy waluty w tekście. `¥` i `$` mogą stać także przed liczbą. */
export const CURRENCY_SYMBOLS = {
  zł: 'PLN',
  PLN: 'PLN',
  '¥': 'JPY',
  JPY: 'JPY',
  $: 'USD',
  USD: 'USD',
  '€': 'EUR',
  EUR: 'EUR',
} as const satisfies Record<string, Currency>;

export type CurrencySymbol = keyof typeof CURRENCY_SYMBOLS;

/** Przyimki wyznaczające przypadek (4.3.3). `na` → biernik tylko dla godzin. */
export const CASE_PREPOSITIONS = {
  genitive: ['bez', 'dla', 'do', 'koło', 'obok', 'od', 'około', 'oprócz', 'podczas', 'spośród', 'u', 'wśród', 'zamiast'],
  dative: ['dzięki', 'ku', 'przeciw', 'wbrew'],
  instrumental: ['nad', 'przed'],
  locative: ['o', 'po', 'przy', 'w'],
  accusative: ['na'],
} as const satisfies Partial<Record<GrammaticalCase, readonly string[]>>;

/** Rozpoznana liczba w tekście (przed zamianą na słowa). */
export interface NumberToken {
  /** Fragment źródłowy, np. `o 3`, `100 ¥`, `w 2024 r.`. */
  source: string;
  pattern: NumberPattern;
  /** Część całkowita (bez separatora tysięcy). */
  integer: bigint;
  /** Cyfry części dziesiętnej, np. `"25"` dla `2,25`. */
  fraction?: string;
  negative: boolean;
  /** Dla `time`. */
  minutes?: number;
  currency?: Currency;
  /** Przyimek bezpośrednio przed liczbą (jeśli rozpoznany). */
  preposition?: string;
}

/** Wynik rozwinięcia — źródło KK203 (oraz KK204 przy `defaulted`). */
export interface NumberExpansion {
  source: string;
  result: string;
  pattern: NumberPattern;
  grammaticalCase: GrammaticalCase;
  /**
   * `true` = mianownik domyślny z braku kontekstu (przyimek spoza tabeli,
   * rok bez przyimka, liczba ≥ miliard czytana cyfra po cyfrze) → KK204.
   */
  defaulted: boolean;
}
