/**
 * Spłaszczenie leksykonu serii do `[Koko Lexicon]` (Koko-Lexicon v1, §3).
 * Deterministyczne — wynik wchodzi do hasha `subtitles.ass` w Koko-Pack.
 *
 * Kolejność:
 * 1. wpisy wg kluczy w porządku kodów Unicode;
 * 2. na wpis: komentarz → `klucz[*]` → aliasy (kolejność tablicy, `alias[*]`)
 *    → formy wg kodów Unicode (nigdy `*`).
 */

/** Dopisek do komentarza przy `verified = true`. */
export const FLATTEN_VERIFIED_SUFFIX = ' (sprawdzone)' as const;
/** Komentarz przy samym `verified` (bez `note`). */
export const FLATTEN_VERIFIED_ONLY = '(sprawdzone)' as const;
/** Prefiks wartości z `respell`. */
export const FLATTEN_RESPELL_PREFIX = '~' as const;

/** `; <note>[ (sprawdzone)]` — nowe linie w `note` zamienione na spacje. */
export interface FlattenedCommentLine {
  type: 'comment';
  text: string;
}

/** `klucz[*] = wartość` — jedna spacja wokół `=`, bez spacji na końcu. */
export interface FlattenedEntryLine {
  type: 'entry';
  /** Skąd pochodzi linia we wpisie serii. */
  role: 'key' | 'alias' | 'form';
  /** Klucz wpisu serii, z którego powstała linia. */
  entryKey: string;
  word: string;
  /** Zawsze `false` dla form. */
  stem: boolean;
  /** `ipa` albo `~respell`. */
  value: string;
}

export type FlattenedLine = FlattenedCommentLine | FlattenedEntryLine;

export interface FlattenResult {
  lines: FlattenedLine[];
  /** Gotowy tekst do dopisania po wpisach odcinka (linie rozdzielone `\n`). */
  text: string;
  /** Wpisy serii pominięte, bo przegrywają z leksykonem odcinka. */
  skippedEntries: string[];
}
