/**
 * Typy wspólne dla Koko-ASS i Koko-Pack.
 * Brak zależności od reszty modułów — ten plik importują wszystkie pozostałe.
 */

/** Liczba całkowita milisekund na osi czasu napisów (0 = początek odcinka). */
export type Ms = number;

/** Liczba próbek audio (całkowita). */
export type Samples = number;

/** Decybele (może być ujemne). */
export type Db = number;

/** Hash w zapisie `sha256:<64 hex małymi literami>`. */
export type Sha256 = `sha256:${string}`;

/**
 * Odcisk pliku wideo: `sha256:` z pierwszego i ostatniego 1 MiB
 * + rozmiar jako 8 B little-endian. Ten sam algorytm w Koko-ASS i Koko-Pack.
 */
export type VideoFingerprint = Sha256;

/** Data i czas ISO 8601 w UTC, np. `2026-09-30T16:47:53Z`. */
export type IsoDateTime = string;

/** Tag języka BCP 47, np. `pl`. */
export type LanguageTag = string;

/** Dane binarne zakodowane w base64. */
export type Base64 = string;

/** Tekst IPA (symbole ze słownika modelu Kokoro PL). */
export type Ipa = string;

// ─── Diagnostyka ────────────────────────────────────────────────────────────

export type DiagnosticLevel = 'error' | 'warning' | 'info';

/** Miejsce w pliku źródłowym, którego dotyczy diagnostyka. */
export interface SourceLocation {
  /** Plik, np. `subtitles.ass`, `koko-lexicon.toml`, `manifest.json`. */
  file?: string;
  /** Numer linii (od 1). */
  line?: number;
  /** Kolumna (od 1). */
  column?: number;
  /** Nazwa sekcji, np. `Koko Rules`. */
  section?: string;
}

/** Opis kodu diagnostycznego ze specyfikacji. */
export interface DiagnosticDefinition<L extends DiagnosticLevel = DiagnosticLevel> {
  readonly level: L;
  readonly title: string;
}

/** Rodzajowa diagnostyka; konkretne kody zawężają `code`, `level` i `data`. */
export interface Diagnostic<
  C extends string = string,
  L extends DiagnosticLevel = DiagnosticLevel,
  D = undefined,
> {
  code: C;
  level: L;
  /** Komunikat dla użytkownika (gotowy do wyświetlenia). */
  message?: string;
  location?: SourceLocation;
  /** Dane specyficzne dla kodu. */
  data?: D;
}

/**
 * Buduje unię diagnostyk z tabeli definicji i mapy danych.
 * Dla każdego kodu `level` jest stałą, a `data` ma właściwy typ.
 */
export type DiagnosticUnion<
  Defs extends Record<string, DiagnosticDefinition>,
  Data extends Partial<Record<keyof Defs, unknown>>,
> = {
  [C in keyof Defs & string]: Diagnostic<
    C,
    Defs[C]['level'],
    C extends keyof Data ? Data[C] : undefined
  >;
}[keyof Defs & string];
