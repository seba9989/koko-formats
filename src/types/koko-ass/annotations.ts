/**
 * Adnotacje `{!kk …}` w polu Text: surowe elementy bloku, klucze linii
 * i znaczniki w tekście (zakresy `ipa=` / `sub=`, pauzy).
 */
import type { Db, Ipa, Ms } from '../common.js';

// ─── Warstwa składniowa (EBNF: annotation / item) ───────────────────────────

export type AnnotationItem =
  | { type: 'flag'; name: string }
  | { type: 'pair'; key: string; value: string; quoted: boolean }
  | { type: 'close' };

/** Jeden blok `{!kk …}` z położeniem w surowym polu Text. */
export interface AnnotationBlock {
  items: AnnotationItem[];
  /** Offset `{` w surowym tekście (jednostki UTF-16). */
  rawStart: number;
  /** Offset za `}`. */
  rawEnd: number;
}

// ─── Klucze linii ───────────────────────────────────────────────────────────

/** Flagi bez wartości (`skip=yes` → KK003). */
export type LineFlag = 'skip' | 'read' | 'join' | 'nojoin';

/** Klucze z wartością działające na całą linię. */
export type LinePairKey = 'say' | 'speed' | 'maxspeed' | 'gain' | 'offset';

/** Klucze działające na fragment tekstu. */
export type InlineKey = 'ipa' | 'sub' | 'pause';

/** Wszystkie znane identyfikatory; inne → KK001. */
export type AnnotationKey = LineFlag | LinePairKey | InlineKey;

/** Klucze linii po scaleniu wszystkich bloków (późniejszy wygrywa). */
export interface LineAnnotations {
  /** Zastępuje cały tekst mówiony (wyświetlany bez zmian). */
  say?: string;
  skip?: true;
  read?: true;
  join?: true;
  nojoin?: true;
  /** Mnożnik prędkości. */
  speed?: number;
  /** Nadpisuje `MaxSpeed`. */
  maxspeed?: number;
  /** Dodawane dB. */
  gain?: Db;
  /** Dodawane do `Offset`. */
  offset?: Ms;
}

// ─── Znaczniki w tekście ────────────────────────────────────────────────────

/**
 * Położenia odnoszą się do tekstu wyświetlanego po usunięciu bloków `{…}`
 * (przed dalszym czyszczeniem), w jednostkach UTF-16.
 */
export interface TextRange {
  start: number;
  end: number;
}

/** `{!kk ipa=…}…{!kk /}` */
export interface IpaSpan {
  type: 'ipa';
  ipa: Ipa;
  range: TextRange;
  /** Zamknięty automatycznie na końcu linii (KK004). */
  autoClosed?: boolean;
}

/** `{!kk sub="…"}…{!kk /}` */
export interface SubSpan {
  type: 'sub';
  text: string;
  range: TextRange;
  autoClosed?: boolean;
}

/** `{!kk pause=300}` (bez zamknięcia). */
export interface PauseMark {
  type: 'pause';
  ms: Ms;
  at: number;
}

export type InlineSpan = IpaSpan | SubSpan;
export type InlineMark = InlineSpan | PauseMark;

/** Wynik odczytu adnotacji z jednej linii. */
export interface ParsedLineAnnotations {
  blocks: AnnotationBlock[];
  line: LineAnnotations;
  marks: InlineMark[];
}
