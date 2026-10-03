/** Standardowe elementy ASS v4.00+: `[V4+ Styles]` i `[Events]`. */
import type { Ms } from '../common.js';

export interface AssStyle {
  name: string;
  fontname: string;
  fontsize: number;
  /** Kolory w zapisie ASS, np. `&H00FFFFFF`. */
  primaryColour: string;
  secondaryColour: string;
  outlineColour: string;
  backColour: string;
  /** W pliku `-1` = prawda, `0` = fałsz. */
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeOut: boolean;
  scaleX: number;
  scaleY: number;
  spacing: number;
  angle: number;
  borderStyle: number;
  outline: number;
  shadow: number;
  /** Numpad 1–9. */
  alignment: number;
  marginL: number;
  marginR: number;
  marginV: number;
  encoding: number;
}

export type AssEventKind = 'Dialogue' | 'Comment';

export interface AssEvent {
  kind: AssEventKind;
  layer: number;
  /** Czas przeliczony z `H:MM:SS.cc` na ms. */
  start: Ms;
  end: Ms;
  style: string;
  /** Pole `Name` (aktor). */
  name: string;
  marginL: number;
  marginR: number;
  marginV: number;
  effect: string;
  /** Surowe pole `Text` z tagami i adnotacjami `{!kk …}`. */
  text: string;
  /** Numer linii w pliku (diagnostyka, `timeline.json → lines`). */
  line: number;
}

// ─── Linie `Format:` ────────────────────────────────────────────────────────

/** Domyślny `Format:` w `[V4+ Styles]` (gdy plik go nie ma). */
export const ASS_STYLE_FORMAT = [
  'Name', 'Fontname', 'Fontsize', 'PrimaryColour', 'SecondaryColour', 'OutlineColour',
  'BackColour', 'Bold', 'Italic', 'Underline', 'StrikeOut', 'ScaleX', 'ScaleY', 'Spacing',
  'Angle', 'BorderStyle', 'Outline', 'Shadow', 'Alignment', 'MarginL', 'MarginR', 'MarginV',
  'Encoding',
] as const;
export type AssStyleColumn = (typeof ASS_STYLE_FORMAT)[number];

/** Domyślny `Format:` w `[Events]`. Ostatnia kolumna (`Text`) może zawierać przecinki. */
export const ASS_EVENT_FORMAT = [
  'Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text',
] as const;
export type AssEventColumn = (typeof ASS_EVENT_FORMAT)[number];

/** Nazwa kolumny → pole obiektu (`PrimaryColour` → `primaryColour`). */
export type AssFieldName<C extends string> = Uncapitalize<C>;

/** Pola `AssStyle` i `AssEvent` odpowiadające kolumnom (kontrola zgodności typów). */
export type AssStyleField = AssFieldName<AssStyleColumn> & keyof AssStyle;
export type AssEventField = AssFieldName<AssEventColumn> & keyof AssEvent;

/** Kolumny stylu będące wartościami logicznymi (`-1` / `0`). */
export const ASS_STYLE_BOOL_FIELDS = ['bold', 'italic', 'underline', 'strikeOut'] as const satisfies readonly AssStyleField[];

/** Kolumny tekstowe (bez konwersji na liczbę). */
export const ASS_STYLE_STRING_FIELDS = [
  'name', 'fontname', 'primaryColour', 'secondaryColour', 'outlineColour', 'backColour',
] as const satisfies readonly AssStyleField[];
export const ASS_EVENT_STRING_FIELDS = ['style', 'name', 'effect', 'text'] as const satisfies readonly AssEventField[];

/** Kolumny liczbowe (`Number(v) || 0`). */
export const ASS_STYLE_NUMBER_FIELDS = [
  'fontsize', 'scaleX', 'scaleY', 'spacing', 'angle', 'borderStyle', 'outline', 'shadow',
  'alignment', 'marginL', 'marginR', 'marginV', 'encoding',
] as const satisfies readonly AssStyleField[];
export const ASS_EVENT_NUMBER_FIELDS = ['layer', 'marginL', 'marginR', 'marginV'] as const satisfies readonly AssEventField[];

/** Kolumny czasu (`H:MM:SS.cc` ↔ ms). */
export const ASS_EVENT_TIME_FIELDS = ['start', 'end'] as const satisfies readonly AssEventField[];

// ─── Wartości domyślne ──────────────────────────────────────────────────────

/**
 * Styl domyślny, jak „Default” w Aegisubie (specyfikacja ASS nie definiuje
 * wartości domyślnych). Parser zaczyna od niego, gdy `Format:` nie ma
 * wszystkich kolumn; Koko-Editor — przy tworzeniu nowego stylu.
 */
export const ASS_STYLE_DEFAULTS = {
  name: 'Default',
  fontname: 'Arial',
  fontsize: 20,
  primaryColour: '&H00FFFFFF',
  secondaryColour: '&H000000FF',
  outlineColour: '&H00000000',
  backColour: '&H00000000',
  bold: false,
  italic: false,
  underline: false,
  strikeOut: false,
  scaleX: 100,
  scaleY: 100,
  spacing: 0,
  angle: 0,
  borderStyle: 1,
  outline: 2,
  shadow: 2,
  alignment: 2,
  marginL: 10,
  marginR: 10,
  marginV: 10,
  encoding: 1,
} as const satisfies AssStyle;

/** Pola zdarzenia poza `kind` i `line` (te zależą od miejsca w pliku). */
export const ASS_EVENT_DEFAULTS = {
  layer: 0,
  start: 0,
  end: 0,
  style: 'Default',
  name: '',
  marginL: 0,
  marginR: 0,
  marginV: 0,
  effect: '',
  text: '',
} as const satisfies Omit<AssEvent, 'kind' | 'line'>;

// ─── Kontrola kompletności list pól (tylko typy, bez kodu w runtime) ────────

type Assert<T extends true> = T;
type Missing<All, Covered> = Exclude<All, Covered>;

/** Każde pole stylu jest w dokładnie jednej z list: tekstowe / logiczne / liczbowe. */
export type AssStyleFieldsCovered = Assert<
  Missing<
    AssStyleField,
    | (typeof ASS_STYLE_STRING_FIELDS)[number]
    | (typeof ASS_STYLE_BOOL_FIELDS)[number]
    | (typeof ASS_STYLE_NUMBER_FIELDS)[number]
  > extends never ? true : false
>;

/** Każde pole zdarzenia z `Format:` jest w jednej z list: czasu / tekstowe / liczbowe. */
export type AssEventFieldsCovered = Assert<
  Missing<
    AssEventField,
    | (typeof ASS_EVENT_TIME_FIELDS)[number]
    | (typeof ASS_EVENT_STRING_FIELDS)[number]
    | (typeof ASS_EVENT_NUMBER_FIELDS)[number]
  > extends never ? true : false
>;

/** Typy zdarzeń ASS, których parser nie interpretuje (zachowywane dosłownie). */
export type AssOtherEventKind = 'Picture' | 'Sound' | 'Movie' | 'Command';

/** Format odczytany z pliku — kolejność kolumn do zapisu. */
export interface AssFormats {
  styles: string[];
  events: string[];
}
