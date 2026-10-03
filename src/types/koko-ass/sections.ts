/**
 * Surowa warstwa sekcji `[Koko …]`: linie `klucz = wartość`, zanim zostaną
 * zinterpretowane. Przydatne dla edytora (zachowanie kolejności, komentarzy).
 */

/** Sekcje rozszerzeń w zalecanej kolejności (przed `[V4+ Styles]`). */
export const KOKO_SECTION_NAMES = [
  'Koko Lektor',
  'Koko Rules',
  'Koko Styles',
  'Koko Lexicon',
  'Koko Sources',
] as const;

export type KokoSectionName = (typeof KOKO_SECTION_NAMES)[number];

/** Standardowe sekcje ASS rozpoznawane przez parser. */
export const ASS_SECTION_NAMES = ['Script Info', 'V4+ Styles', 'Events'] as const;
export type AssSectionName = (typeof ASS_SECTION_NAMES)[number];

/** Każda sekcja, którą parser interpretuje; pozostałe trafiają do `otherSections`. */
export type KnownSectionName = AssSectionName | KokoSectionName;

// ─── Warstwa tekstowa (pierwszy etap parsowania) ────────────────────────────

/** Niepusta linia pliku po przycięciu, z numerem (od 1). */
export interface TextLine {
  text: string;
  line: number;
}

/** Sekcja pliku przed interpretacją — nazwa z nagłówka `[…]` i jej linie. */
export interface TextSection {
  /** Nazwa bez nawiasów, w oryginalnej pisowni. */
  name: string;
  /** Linia nagłówka. */
  line: number;
  lines: TextLine[];
}

/** Sposób zapisu pliku — do odtworzenia przy zapisie. */
export interface TextFileFormat {
  eol: '\n' | '\r\n';
  bom: boolean;
}

/** Linia sekcji po podziale przy pierwszym `=` i przycięciu obu stron. */
export interface RawKeyValueLine {
  type: 'entry';
  /** Klucz w oryginalnej pisowni (porównania bez rozróżniania wielkości liter). */
  key: string;
  value: string;
  line: number;
}

/** Linia zaczynająca się od `;`. */
export interface RawCommentLine {
  type: 'comment';
  text: string;
  line: number;
}

export type RawSectionLine = RawKeyValueLine | RawCommentLine;

export interface RawKokoSection {
  name: KokoSectionName;
  /** Linia nagłówka `[Koko …]`. */
  line: number;
  lines: RawSectionLine[];
}

/** Wartości logiczne akceptowane w nagłówku (bez rozróżniania wielkości liter). */
export const RAW_BOOL_VALUES = {
  yes: true,
  true: true,
  '1': true,
  tak: true,
  no: false,
  false: false,
  '0': false,
  nie: false,
} as const satisfies Record<string, boolean>;

export type RawBool = keyof typeof RAW_BOOL_VALUES;

/**
 * Wzorzec nazwy (styl, wyraz): `*` = dowolny ciąg, `?` = jeden znak,
 * dopasowanie do całej nazwy. Wielkość liter: patrz miejsce użycia.
 */
export type WildcardPattern = string;
