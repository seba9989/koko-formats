/**
 * Parser Koko-ASS v1: tekst `.ass` → `KokoAssDocument`.
 *
 *   tekst → sekcje → surowe wpisy [Koko …] → interpretacja z domyślnymi → dokument
 *
 * Nie rzuca wyjątków z powodu danych — problemy trafiają do `diagnostics`.
 */
import { ASS_EVENT_FORMAT, ASS_SECTION_NAMES, ASS_STYLE_FORMAT, KOKO_SECTION_NAMES } from '../../types/index.js';
import type {
  AssEvent, AssStyle, KkDiagnostic, KokoAssDocument, KokoAssFileParseResult, KokoAssLayout, KokoSectionName,
  OtherSection, RawKokoSection, ScriptInfo,
} from '../../types/index.js';
import { parseAssStyles, parseEvents, parseScriptInfo } from './ass.js';
import { interpretLektor, interpretLexicon, interpretRules, interpretSources, interpretStyles } from './koko.js';
import { parseKokoSection, splitSections } from './text.js';
import { findName, reporter } from './util.js';

export { parseAssTime } from './ass.js';
export { toField } from './util.js';

export function parseKokoAss(input: string): KokoAssFileParseResult {
  const diagnostics: KkDiagnostic[] = [];
  const report = (section: string) => reporter(diagnostics, section);

  const { sections, format } = splitSections(input);
  const layout: KokoAssLayout = {
    format,
    order: [],
    assFormats: { styles: [...ASS_STYLE_FORMAT], events: [...ASS_EVENT_FORMAT] },
    extraEventLines: [],
  };

  let scriptInfo: ScriptInfo = { scriptType: 'v4.00+', kokoAnimeVersion: null, other: {} };
  let assStyles: AssStyle[] = [];
  let events: AssEvent[] = [];
  const rawSections: RawKokoSection[] = [];
  const otherSections: OtherSection[] = [];

  // ─── 1. Zbierz sekcje w kolejności z pliku ────────────────────────────────

  for (const section of sections) {
    const koko = findName(KOKO_SECTION_NAMES, section.name);
    if (koko) {
      const parsed = parseKokoSection(section, koko, report(koko));
      const existing = rawSections.find((r) => r.name === koko);

      if (existing) {
        existing.lines.push(...parsed.lines); // powtórzona sekcja — dopisz do pierwszej
      } else {
        rawSections.push(parsed);
        layout.order.push({ kind: 'koko', name: koko });
      }
      continue;
    }

    const ass = findName(ASS_SECTION_NAMES, section.name);
    switch (ass) {
      case 'Script Info':
        scriptInfo = parseScriptInfo(section, report(ass));
        layout.order.push({ kind: 'scriptInfo' });
        break;
      case 'V4+ Styles':
        assStyles = parseAssStyles(section, layout);
        layout.order.push({ kind: 'styles' });
        break;
      case 'Events':
        events = parseEvents(section, layout, report(ass));
        layout.order.push({ kind: 'events' });
        break;
      case undefined:
        layout.order.push({ kind: 'other', index: otherSections.length });
        otherSections.push({ name: section.name, text: section.lines.map((l) => l.text).join(format.eol) });
        break;
      default: {
        const unhandled: never = ass;
        throw new Error(`Nieobsłużona sekcja: ${unhandled}`);
      }
    }
  }

  // ─── 2. Zinterpretuj sekcje Koko ──────────────────────────────────────────

  return {
    document: {
      scriptInfo,
      ...interpretKoko(rawSections, diagnostics),
      assStyles,
      events,
      rawSections,
      otherSections,
    },
    // Interpretacja Koko dzieje się po zebraniu sekcji — przywróć kolejność z pliku.
    diagnostics: sortByLine(diagnostics),
    layout,
  };
}

/** Konfiguracja z sekcji Koko — osobno, żeby edytor mógł ją przeliczyć po zmianie klucza. */
export function interpretKoko(
  rawSections: readonly RawKokoSection[],
  diagnostics: KkDiagnostic[],
): Pick<KokoAssDocument, 'lektor' | 'rules' | 'styles' | 'lexicon' | 'sources'> {
  const raw = (name: KokoSectionName) => rawSections.find((r) => r.name === name);
  const report = (name: KokoSectionName) => reporter(diagnostics, name);

  return {
    lektor: interpretLektor(raw('Koko Lektor'), report('Koko Lektor')),
    rules: interpretRules(raw('Koko Rules'), report('Koko Rules')),
    styles: interpretStyles(raw('Koko Styles'), report('Koko Styles')),
    lexicon: interpretLexicon(raw('Koko Lexicon'), report('Koko Lexicon')),
    sources: interpretSources(raw('Koko Sources'), report('Koko Sources')),
  };
}

/** Diagnostyki w kolejności linii pliku. */
export function sortByLine(diagnostics: KkDiagnostic[]): KkDiagnostic[] {
  return diagnostics.sort((a, b) => (a.location?.line ?? 0) - (b.location?.line ?? 0));
}
