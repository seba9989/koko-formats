/**
 * `[Koko Lexicon]` odcinka i jego połączenie z leksykonem serii
 * (Koko-ASS §2, integracja z Koko-Lexicon v1).
 * Format pliku `koko-lexicon.toml` — moduł `koko-lexicon`.
 */
import type { KlDiagnostic } from '../koko-lexicon/diagnostics.js';
import type { LexiconValue, SeriesLexiconFile } from '../koko-lexicon/file.js';


/** Sufiks klucza oznaczający rdzeń (`Jinshi*`). */
export const LEXICON_STEM_SUFFIX = '*' as const;
/** Prefiks wartości oznaczający pisownię fonetyczną (`~Giokujo`). */
export const LEXICON_RESPELL_PREFIX = '~' as const;

export type LexiconOrigin = 'episode' | 'series';

/**
 * Wpis leksykonu w postaci linii `[Koko Lexicon]`.
 * Dopasowanie: całe słowa (granice `\p{L}\p{N}`), bez rozróżniania wielkości
 * liter, najdłuższy klucz wygrywa. Tekst w zakresach `ipa=`/`sub=` nie podlega leksykonowi.
 */
export interface LexiconEntry {
  /** Klucz bez `*`; może być frazą (między wyrazami dowolne spacje). */
  key: string;
  /** Wyrazy klucza po podziale na białe znaki. */
  words: string[];
  /** `rdzeń*` — także formy odmienione; końcówka przez Phonemis, doklejona. */
  stem: boolean;
  value: LexiconValue;
  origin: LexiconOrigin;
  /** Dla wpisów serii: klucz wpisu w TOML (linie aliasów i form mają klucz wpisu-rodzica). */
  seriesEntryKey?: string;
  /** Komentarz `;` nad wpisem (po spłaszczeniu: `note` + „(sprawdzone)”). */
  comment?: string;
  /** Linia w `.ass`. */
  line?: number;
}

/** Stan leksykonu serii przy przetwarzaniu odcinka. */
export type SeriesLexiconStatus =
  /** Wczytany poprawnie (mogą być ostrzeżenia KL003–KL006). */
  | { kind: 'loaded'; path: string; file: SeriesLexiconFile }
  /** `SeriesLexicon = none` (zawsze w paczce Koko-Pack). */
  | { kind: 'disabled' }
  /** Domyślny plik nie istnieje — brak leksykonu, bez diagnostyki. */
  | { kind: 'absent'; path: string }
  /** Wskazany jawnie, a brak pliku → KK009. */
  | { kind: 'missing'; path: string }
  /** KL001 / KL002 — plik pominięty, działa jak brak leksykonu. */
  | { kind: 'invalid'; path: string };

/** Połączony leksykon używany przy przetwarzaniu. */
export interface ResolvedLexicon {
  /** Wpisy odcinka + wpisy serii (bez przegranych), gotowe do dopasowania. */
  entries: LexiconEntry[];
  series: SeriesLexiconStatus;
  /**
   * Wpisy serii pominięte w całości, bo ich klucz, alias lub forma
   * pokrywa się (bez rozróżniania wielkości liter) z kluczem odcinka.
   */
  shadowedSeriesKeys: string[];
  /** Diagnostyka pliku serii. */
  seriesDiagnostics: KlDiagnostic[];
}
