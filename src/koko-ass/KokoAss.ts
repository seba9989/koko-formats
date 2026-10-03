/**
 * KokoAss — plik Koko-ASS do odczytu, edycji i zapisu.
 *
 *   const ass = KokoAss.parse(text);
 *   ass.set('Koko Rules', 'Numbers', 'auto');
 *   ass.events[0].text = '…';
 *   await writeFile(path, ass.toString());
 */
import { KOKO_ASS_VERSION, KOKO_SECTION_NAMES } from '../types/index.js';
import type {
  AssEvent, AssStyle, KkDiagnostic, KokoAssDocument, KokoAssLayout, KokoLektor, KokoRules,
  KokoSectionName, KokoSources, KokoStyles, LexiconEntry, RawCommentLine, RawKeyValueLine, RawKokoSection, ScriptInfo,
} from '../types/index.js';
import { interpretKoko, parseKokoAss, sortByLine } from './parser/index.js';
import { writeKokoAss } from './writer.js';

/** Linia do dopisania — numer linii nadaje plik dopiero po zapisie. */
export type NewSectionLine = Omit<RawKeyValueLine, 'line'> | Omit<RawCommentLine, 'line'>;

const EMPTY_FILE = [
  '[Script Info]',
  'ScriptType: v4.00+',
  `KokoAnime Version: ${KOKO_ASS_VERSION}`,
  '',
  '[V4+ Styles]',
  '',
  '[Events]',
  '',
].join('\n');

export class KokoAss {
  readonly #doc: KokoAssDocument;
  readonly #layout: KokoAssLayout;
  /** Diagnostyki sekcji ASS — stałe od parsowania. */
  readonly #fileDiagnostics: KkDiagnostic[];
  /** Diagnostyki sekcji Koko — przeliczane po każdej zmianie klucza. */
  #kokoDiagnostics: KkDiagnostic[];

  private constructor(doc: KokoAssDocument, layout: KokoAssLayout, diagnostics: KkDiagnostic[]) {
    this.#doc = doc;
    this.#layout = layout;
    this.#fileDiagnostics = diagnostics.filter((d) => !isKokoSection(d.location?.section));
    this.#kokoDiagnostics = diagnostics.filter((d) => isKokoSection(d.location?.section));
  }

  // ─── Tworzenie ────────────────────────────────────────────────────────────

  static parse(text: string): KokoAss {
    const { document, diagnostics, layout } = parseKokoAss(text);
    return new KokoAss(document, layout, diagnostics);
  }

  /** Pusty plik Koko-ASS (`KokoAnime Version: 1`, sekcje stylów i zdarzeń). */
  static create(): KokoAss {
    return KokoAss.parse(EMPTY_FILE);
  }

  // ─── Odczyt ───────────────────────────────────────────────────────────────

  get document(): Readonly<KokoAssDocument> { return this.#doc; }
  get scriptInfo(): ScriptInfo { return this.#doc.scriptInfo; }

  get lektor(): Readonly<KokoLektor> { return this.#doc.lektor; }
  get rules(): Readonly<KokoRules> { return this.#doc.rules; }
  get kokoStyles(): Readonly<KokoStyles> { return this.#doc.styles; }
  get lexicon(): readonly LexiconEntry[] { return this.#doc.lexicon; }
  get sources(): Readonly<KokoSources> { return this.#doc.sources; }

  /** Style ASS — edytowalne wprost. */
  get assStyles(): AssStyle[] { return this.#doc.assStyles; }
  /** Zdarzenia ASS — edytowalne wprost. */
  get events(): AssEvent[] { return this.#doc.events; }

  get diagnostics(): readonly KkDiagnostic[] {
    return sortByLine([...this.#fileDiagnostics, ...this.#kokoDiagnostics]);
  }

  /** `true`, gdy plik ma `KokoAnime Version` (inaczej to zwykły ASS). */
  get isKoko(): boolean {
    return this.#doc.scriptInfo.kokoAnimeVersion !== null;
  }

  /** Zdarzenia `Dialogue` w kolejności startu. */
  dialogues(): AssEvent[] {
    return this.#doc.events.filter((e) => e.kind === 'Dialogue').sort((a, b) => a.start - b.start);
  }

  assStyle(name: string): AssStyle | undefined {
    return this.#doc.assStyles.find((s) => s.name === name);
  }

  // ─── Klucze sekcji Koko ───────────────────────────────────────────────────

  /** Surowa wartość klucza; przy powtórzeniach — ostatnia (jak w specyfikacji). */
  get(section: KokoSectionName, key: string): string | undefined {
    return this.#entries(section, key).at(-1)?.value;
  }

  /**
   * Ustawia `klucz = wartość` i przelicza konfigurację. Powtórzenia klucza są
   * usuwane; brakująca sekcja powstaje przed `[V4+ Styles]`.
   * W `[Koko Lexicon]` klucz zawiera ewentualne `*`.
   */
  set(section: KokoSectionName, key: string, value: string): void {
    const raw = this.#section(section) ?? this.#addSection(section);
    const [first, ...duplicates] = this.#entries(section, key);

    if (first) {
      first.value = value;
      raw.lines = raw.lines.filter((l) => !duplicates.includes(l as RawKeyValueLine));
    } else {
      raw.lines.push({ type: 'entry', key, value, line: 0 });
    }

    this.#reinterpret();
  }

  /** Usuwa wszystkie wystąpienia klucza. */
  remove(section: KokoSectionName, key: string): void {
    const raw = this.#section(section);
    if (!raw) return;

    const matches = this.#entries(section, key);
    raw.lines = raw.lines.filter((l) => !matches.includes(l as RawKeyValueLine));
    this.#reinterpret();
  }

  /**
   * Dopisuje linie na końcu sekcji Koko (tworzy ją, jeśli trzeba) i przelicza
   * konfigurację — np. spłaszczony leksykon serii przy pakowaniu.
   */
  appendLines(section: KokoSectionName, lines: readonly NewSectionLine[]): void {
    const raw = this.#section(section) ?? this.#addSection(section);
    raw.lines.push(...lines.map((l) => ({ ...l, line: 0 })));
    this.#reinterpret();
  }

  /** Zamienia zwykły ASS w Koko-ASS. */
  enableKoko(): void {
    this.#doc.scriptInfo.kokoAnimeVersion = KOKO_ASS_VERSION;
  }

  // ─── Zapis ────────────────────────────────────────────────────────────────

  toString(): string {
    return writeKokoAss(this.#doc, this.#layout);
  }

  // ─── Wewnętrzne ───────────────────────────────────────────────────────────

  #section(name: KokoSectionName): RawKokoSection | undefined {
    return this.#doc.rawSections.find((s) => s.name === name);
  }

  #entries(section: KokoSectionName, key: string): RawKeyValueLine[] {
    const lower = key.toLowerCase();
    return (this.#section(section)?.lines ?? []).filter(
      (l): l is RawKeyValueLine => l.type === 'entry' && l.key.toLowerCase() === lower,
    );
  }

  /**
   * Nowa sekcja Koko w kolejności ze specyfikacji (Lektor, Rules, Styles, Lexicon,
   * Sources): przed pierwszą późniejszą sekcją Koko, inaczej za ostatnią sekcją
   * Koko albo `[Script Info]` — zawsze przed `[V4+ Styles]`.
   */
  #addSection(name: KokoSectionName): RawKokoSection {
    const raw: RawKokoSection = { name, line: 0, lines: [] };
    this.#doc.rawSections.push(raw);

    const order = this.#layout.order;
    const rank = KOKO_SECTION_NAMES.indexOf(name);
    const later = order.findIndex((s) => s.kind === 'koko' && KOKO_SECTION_NAMES.indexOf(s.name) > rank);
    const anchor = order.findLastIndex((s) => s.kind === 'koko' || s.kind === 'scriptInfo');

    const at = later >= 0 ? later : anchor >= 0 ? anchor + 1 : 0;
    order.splice(at, 0, { kind: 'koko', name });
    return raw;
  }

  #reinterpret(): void {
    const diagnostics: KkDiagnostic[] = [];
    Object.assign(this.#doc, interpretKoko(this.#doc.rawSections, diagnostics));
    this.#kokoDiagnostics = diagnostics;
  }
}

function isKokoSection(section: string | undefined): boolean {
  return section !== undefined && (KOKO_SECTION_NAMES as readonly string[]).includes(section);
}
