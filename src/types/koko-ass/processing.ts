/**
 * Parsowanie deterministyczne (Koko-ASS §4.1–4.5):
 * klasyfikacja → czyszczenie → łączenie → parametry wypowiedzi.
 * Wynik tego etapu jest wejściem do syntezy i do kluczy Koko-Pack.
 */
import type { Db, Ipa, Ms } from '../common.js';
import type { KokoStyleMode } from './header.js';
import type { LineAnnotations } from './annotations.js';
import type { NumberExpansion } from './numbers.js';

// ─── §4.1 Klasyfikacja linii ────────────────────────────────────────────────

/** Powód pominięcia, w kolejności reguł (pierwsza pasująca wygrywa). */
export type SkipReason =
  | 'comment' //         1. zdarzenie Comment:
  | 'empty' //           2./9. pusty tekst mówiony
  | 'annotation' //      3. {!kk skip}
  | 'skipStyle' //       4. SkipStyles / skip w [Koko Styles]
  | 'notInReadStyles' // 5. ReadStyles nie pasuje
  | 'effect' //          6. SkipIfEffect
  | 'noActor' //         7. SkipIfNoActor
  | 'match'; //          8. SkipIfMatch

export type LineClassification =
  | { read: true; /** Czytana dzięki `{!kk read}` mimo reguł. */ forced: boolean }
  | { read: false; reason: SkipReason };

// ─── §4.2 Czyszczenie: segmenty tekstu mówionego ────────────────────────────

/** Tekst przekazywany do G2P (Phonemis). */
export interface TextSegment {
  t: 'text';
  s: string;
  /** Doklejony bez spacji do poprzedniego segmentu. */
  g?: true;
}

/** Gotowe IPA (z `ipa=` lub leksykonu z wartością IPA). */
export interface IpaSegment {
  t: 'ipa';
  s: Ipa;
  g?: true;
}

/** Pauza (`pause=`, myślnik dialogowy = 150 ms). */
export interface PauseSegment {
  t: 'pause';
  ms: Ms;
}

/**
 * Segment tekstu mówionego. Kształt jest zgodny z segmentem kanonicznym
 * klucza Koko-Pack (`{t, s, g}` / `{t, ms}`), ale tu może jeszcze nie być
 * znormalizowany (sąsiednie teksty, pauzy na brzegach).
 */
export type SpokenSegment = TextSegment | IpaSegment | PauseSegment;

/** Pauza za każdy myślnik dialogowy poza pierwszym. */
export const DIALOGUE_DASH_PAUSE_MS = 150 as const;

/** Linia po klasyfikacji i czyszczeniu. */
export interface ProcessedLine {
  /** Indeks w `[Events]`. */
  eventIndex: number;
  /** Numer linii w pliku. */
  line: number;
  start: Ms;
  end: Ms;
  style: string;
  name: string;
  classification: LineClassification;
  annotations: LineAnnotations;
  /** Tekst wyświetlany po usunięciu tagów (dla `SkipIfMatch`, podglądu). */
  displayText: string;
  /** Segmenty mówione (puste, gdy linia pominięta). */
  segments: SpokenSegment[];
  /** Rozwinięcia liczb (tylko `Numbers = auto`). */
  numberExpansions: NumberExpansion[];
}

// ─── §4.5 Parametry wypowiedzi ──────────────────────────────────────────────

/** Efektywne parametry po dziedziczeniu (nagłówek → styl → linia). */
export interface UtteranceParams {
  /** `Speed` × styl × linia — prędkość bazowa przed dopasowaniem. */
  speed: number;
  /** `Gain` + styl + linia. */
  gain: Db;
  /** `Offset` + linia. */
  offset: Ms;
  /** `MaxSpeed` → linia (zastąpienie). */
  maxSpeed: number;
  /** Aplikacja → `Voice`. */
  voice: string;
  /** Etykieta z `[Koko Styles]`. */
  mode?: KokoStyleMode;
}

// ─── §4.4 Łączenie → wypowiedzi ─────────────────────────────────────────────

export type JoinCause = 'flag' | 'auto';

/** Wypowiedź = jedna linia albo grupa połączonych linii (jeden klip). */
export interface Utterance {
  /** Kolejność czasu. */
  index: number;
  /** Indeksy `ProcessedLine` składające się na wypowiedź. */
  lineIndices: number[];
  /** Numery linii w pliku (informacyjnie). */
  lines: number[];
  /** Start pierwszej linii (bez `offset`). */
  start: Ms;
  /** End ostatniej linii — koniec slotu. */
  end: Ms;
  /** Segmenty połączonych linii (rozdzielone spacją). */
  segments: SpokenSegment[];
  /** Parametry z pierwszej linii grupy. */
  params: UtteranceParams;
  join?: JoinCause;
  /** Czytelny tekst mówiony (IPA w `/…/`), np. do podglądu i `timeline.text`. */
  spokenText: string;
}

/** Limit długości grupy (kontekst Kokoro-82M); przekroczenie → rozbicie + KK302. */
export const JOIN_MAX_PHONEME_TOKENS = 510 as const;
