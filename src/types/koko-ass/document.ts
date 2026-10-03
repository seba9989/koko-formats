/** Cały dokument Koko-ASS: plik po parsowaniu i wynik przetwarzania. */
import type { AssEvent, AssFormats, AssStyle } from './ass.js';
import type { KlDiagnostic } from '../koko-lexicon/diagnostics.js';
import type { KkDiagnostic } from './diagnostics.js';
import type { KokoLektor, KokoRules, KokoStyles } from './header.js';
import type { LexiconEntry, ResolvedLexicon } from './lexicon.js';
import type { ProcessedLine, Utterance } from './processing.js';
import type { KokoSectionName, RawKokoSection, TextFileFormat } from './sections.js';
import type { ScriptInfo } from './script-info.js';
import type { KokoSources } from './sources.js';

/** Sekcja nieinterpretowana (np. `[Aegisub Project Garbage]`, `[Fonts]`) zachowana dosłownie. */
export interface OtherSection {
  name: string;
  text: string;
}

/** Miejsce sekcji w pliku — do zapisu w oryginalnej kolejności. */
export type SectionSlot =
  | { kind: 'scriptInfo' }
  | { kind: 'koko'; name: KokoSectionName }
  | { kind: 'styles' }
  | { kind: 'events' }
  | { kind: 'other'; index: number };

/** Plik `.ass` po parsowaniu — konfiguracja z domyślnymi wartościami uzupełnionymi. */
export interface KokoAssDocument {
  scriptInfo: ScriptInfo;
  lektor: KokoLektor;
  rules: KokoRules;
  styles: KokoStyles;
  /** Wpisy `[Koko Lexicon]` odcinka (bez leksykonu serii). */
  lexicon: LexiconEntry[];
  sources: KokoSources;
  assStyles: AssStyle[];
  events: AssEvent[];
  /** Surowe sekcje Koko — do zapisu bez utraty komentarzy i kolejności. */
  rawSections: RawKokoSection[];
  /** Pozostałe sekcje (np. `[Aegisub Project Garbage]`) zachowane dosłownie. */
  otherSections: OtherSection[];
}

/**
 * Wynik pierwszego etapu — sam odczyt pliku (`parseKokoAss`), bez
 * leksykonu serii, klasyfikacji i łączenia. Parser nie rzuca wyjątków:
 * problemy w danych trafiają do `diagnostics`.
 */
export interface KokoAssFileParseResult {
  document: KokoAssDocument;
  diagnostics: KkDiagnostic[];
  /** Informacje potrzebne do zapisu bez zmian w układzie pliku. */
  layout: KokoAssLayout;
}

/** Układ pliku poza modelem danych. */
export interface KokoAssLayout {
  format: TextFileFormat;
  /** Kolejność sekcji w pliku. */
  order: SectionSlot[];
  /** Linie `Format:` odczytane z pliku. */
  assFormats: AssFormats;
  /** Zdarzenia innych typów i komentarze w `[Events]`, zachowane dosłownie. */
  extraEventLines: string[];
}

/** Wynik całego deterministycznego parsowania (bez modelu). */
export interface KokoAssParseResult {
  document: KokoAssDocument;
  layout?: KokoAssLayout;
  /** Leksykon odcinka + serii użyty przy przetwarzaniu. */
  lexicon: ResolvedLexicon;
  lines: ProcessedLine[];
  utterances: Utterance[];
  /** KK z parsowania + KL z pliku leksykonu serii (te same co w `lexicon.seriesDiagnostics`). */
  diagnostics: (KkDiagnostic | KlDiagnostic)[];
}
