/**
 * Plik leksykonu serii `koko-lexicon.toml` (Koko-Lexicon v1, §1).
 * TOML 1.0, UTF-8. Edytuje go Koko-Editor; Koko-Player go nie potrzebuje
 * (paczki mają wpisy spłaszczone do `[Koko Lexicon]`).
 */
import type { Ipa } from '../common.js';

export const SERIES_LEXICON_FORMAT = 'koko-lexicon' as const;
/** Obsługiwana wersja; wyższa → KL002, plik pominięty. */
export const SERIES_LEXICON_VERSION = 1 as const;
export const SERIES_LEXICON_DEFAULT_FILE = 'koko-lexicon.toml' as const;

/**
 * Znaki niedozwolone w kluczach, aliasach i formach (→ KL004).
 * Klucze nie mogą też być puste ani zawierać `*` — rdzeń oznacza `stem`.
 */
export const LEXICON_FORBIDDEN_CHARS = ['=', ';', '*', '[', ']'] as const;
export type LexiconForbiddenChar = (typeof LEXICON_FORBIDDEN_CHARS)[number];

/**
 * Dokładnie jedno z `ipa` / `respell` (oba lub żadne → KL004).
 * Rodzaj wymowy wpisu wyznacza też rodzaj wartości w `forms`.
 */
export type SeriesLexiconPronunciation =
  | { ipa: Ipa; respell?: never }
  | { respell: string; ipa?: never };

/** `[entries.<klucz>]` — klucz jak w `[Koko Lexicon]`, ale **bez** `*`. */
export type SeriesLexiconEntry = SeriesLexiconPronunciation & {
  /** Dopasowanie form odmienionych (= `rdzeń*`); domyślnie `false`. */
  stem?: boolean;
  /** Inne zapisy — ta sama wymowa i ten sam `stem`. */
  aliases?: string[];
  /**
   * Pełna wymowa wybranych form. Wartości tego samego rodzaju co wpis:
   * IPA przy `ipa`, pisownia fonetyczna (bez `~`) przy `respell`.
   * Formy nigdy nie mają `stem`, nie dotyczą aliasów i wygrywają
   * z rdzeniem (najdłuższy klucz).
   */
  forms?: Record<string, string>;
  /** Notatka dla ludzi — bez wpływu na dźwięk. */
  note?: string;
  /** Sprawdzone na słuch — bez wpływu na dźwięk; brak `true` → KL006. */
  verified?: boolean;
};

/** Pola wpisu znane w v1; inne → KL003 (zignorowane). */
export const SERIES_LEXICON_ENTRY_FIELDS = [
  'ipa',
  'respell',
  'stem',
  'aliases',
  'forms',
  'note',
  'verified',
] as const satisfies readonly (keyof SeriesLexiconEntry)[];

/** Cały plik. Brak `format` / `entries` lub zły TOML → KL001. */
export interface SeriesLexiconFile {
  format: typeof SERIES_LEXICON_FORMAT;
  version: number;
  /** Opcjonalny tytuł; przepada przy spłaszczaniu. */
  title?: string;
  entries: Record<string, SeriesLexiconEntry>;
}

/** Wymowa: IPA wprost do syntezy albo pisownia fonetyczna (`~…`) dla Phonemis. */
export type LexiconValue =
  | { kind: 'ipa'; ipa: Ipa }
  | { kind: 'respell'; text: string };

/** Wpis serii po walidacji: KL003–KL005 zastosowane, formy w kolejności kodów Unicode. */
export interface ValidatedSeriesEntry {
  key: string;
  value: LexiconValue;
  stem: boolean;
  aliases: string[];
  /** Wartość formy ma ten sam rodzaj (`kind`) co wpis. */
  forms: { form: string; value: LexiconValue }[];
  note?: string;
  verified: boolean;
}

/** Rola słowa we wpisie — każde słowo (bez rozróżniania wielkości liter) tylko w jednym wpisie (KL005). */
export type LexiconWordRole = 'key' | 'alias' | 'form';

/** Indeks słów wpisów serii, używany do KL005 i do pierwszeństwa odcinka. */
export interface LexiconWordOwner {
  word: string;
  role: LexiconWordRole;
  /** Klucz wpisu, do którego słowo należy. */
  entryKey: string;
}
