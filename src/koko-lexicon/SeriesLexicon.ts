/**
 * SeriesLexicon — plik `koko-lexicon.toml` (Koko-Lexicon v1) do odczytu,
 * edycji, spłaszczania i zapisu.
 *
 *   const lexicon = SeriesLexicon.parse(toml);
 *   lexicon.set('Jinshi', { ipa: 'dʑinɕi', stem: true, verified: true });
 *   lexicon.embedInto(ass);            // przed pakowaniem do Koko-Pack
 *   await writeFile(path, lexicon.toString());
 */
import { type } from 'arktype';
import { parse, stringify, TomlError } from 'smol-toml';
import {
  FLATTEN_RESPELL_PREFIX, FLATTEN_VERIFIED_ONLY, FLATTEN_VERIFIED_SUFFIX, SERIES_LEXICON_FORMAT,
  SERIES_LEXICON_VERSION,
} from '../types/index.js';
import type {
  FlattenedEntryLine, FlattenedLine, FlattenResult, KlDiagnostic, LexiconEntry, LexiconValue, SeriesLexiconEntry,
  ValidatedSeriesEntry,
} from '../types/index.js';
import type { KokoAss } from '../koko-ass/KokoAss.js';
import { LEXICON_HEADER } from './schemas.js';
import { compareCodePoints, kl, validateEntries } from './validate.js';

const TOP_LEVEL_FIELDS = ['format', 'version', 'title', 'entries'];

export class SeriesLexicon {
  /** Surowe wpisy z TOML — źródło prawdy, zapisywane przez `toString()`. */
  readonly #raw: Record<string, unknown>;
  #title: string | undefined;
  /** KL001/KL002 dla całego pliku — wtedy leksykon działa jak pusty. */
  readonly #fileDiagnostics: KlDiagnostic[];

  #entries: ValidatedSeriesEntry[] = [];
  #entryDiagnostics: KlDiagnostic[] = [];

  private constructor(raw: Record<string, unknown>, title: string | undefined, fileDiagnostics: KlDiagnostic[]) {
    this.#raw = raw;
    this.#title = title;
    this.#fileDiagnostics = fileDiagnostics;
    this.#revalidate();
  }

  // ─── Tworzenie ────────────────────────────────────────────────────────────

  /** Nie rzuca: błędny plik daje KL001/KL002 i pusty leksykon (`usable === false`). */
  static parse(toml: string): SeriesLexicon {
    let doc: Record<string, unknown>;
    try {
      doc = parse(toml);
    } catch (error) {
      const location = error instanceof TomlError ? { line: error.line, column: error.column } : {};
      const diagnostic = { ...kl('KL001', String(error), { reason: 'toml' }), location };
      return new SeriesLexicon({}, undefined, [diagnostic]);
    }

    const fatal = SeriesLexicon.#checkHeader(doc);
    if (fatal) return new SeriesLexicon({}, undefined, [fatal]);

    const notes: KlDiagnostic[] = Object.keys(doc)
      .filter((field) => !TOP_LEVEL_FIELDS.includes(field))
      .map((field) => kl('KL003', `Nieznane pole ${field}`, { field }));

    const title = typeof doc.title === 'string' ? doc.title : undefined;
    return new SeriesLexicon({ ...(doc.entries as Record<string, unknown>) }, title, notes);
  }

  static create(title?: string): SeriesLexicon {
    return new SeriesLexicon({}, title, []);
  }

  /** KL001 (z polem, którego dotyczy błąd) albo KL002; `null`, gdy nagłówek jest poprawny. */
  static #checkHeader(doc: Record<string, unknown>): KlDiagnostic | null {
    const header = LEXICON_HEADER(doc);
    if (header instanceof type.errors) {
      const field = header[0]?.path[0];
      const reason = field === 'format' ? 'missingFormat' : field === 'version' ? 'missingVersion' : 'missingEntries';
      return kl('KL001', header.summary, { reason });
    }
    if (header.version > SERIES_LEXICON_VERSION) {
      return kl('KL002', `Wersja ${header.version} nieobsługiwana`, { found: header.version, supported: SERIES_LEXICON_VERSION });
    }
    return null;
  }

  // ─── Odczyt ───────────────────────────────────────────────────────────────

  get title(): string | undefined { return this.#title; }
  set title(value: string | undefined) { this.#title = value; }

  /** `false` po KL001/KL002 — plik pominięty, działa jak brak leksykonu. */
  get usable(): boolean {
    return this.#fileDiagnostics.every((d) => d.code !== 'KL001' && d.code !== 'KL002');
  }

  /** Wpisy po walidacji, w kolejności kodów Unicode kluczy. */
  get entries(): readonly ValidatedSeriesEntry[] { return this.#entries; }

  get diagnostics(): readonly KlDiagnostic[] {
    return [...this.#fileDiagnostics, ...this.#entryDiagnostics];
  }

  /** Wpis po kluczu, aliasie lub formie (bez rozróżniania wielkości liter). */
  find(word: string): ValidatedSeriesEntry | undefined {
    const lower = word.toLowerCase();
    return this.#entries.find((e) => wordsOf(e).some((w) => w.toLowerCase() === lower));
  }

  /** Surowy wpis z TOML (także niepoprawny). */
  get(key: string): unknown {
    return this.#raw[key];
  }

  // ─── Edycja ───────────────────────────────────────────────────────────────

  /** Ustawia wpis i waliduje leksykon ponownie; problemy trafiają do `diagnostics`. */
  set(key: string, entry: SeriesLexiconEntry): void {
    this.#raw[key] = entry;
    this.#revalidate();
  }

  remove(key: string): void {
    delete this.#raw[key];
    this.#revalidate();
  }

  // ─── Spłaszczanie (§3) ────────────────────────────────────────────────────

  /**
   * Linie `[Koko Lexicon]` w kolejności ze specyfikacji. Wpis, którego klucz,
   * alias lub forma pokrywa się z kluczem odcinka, jest pomijany w całości.
   */
  flatten(episodeKeys: Iterable<string> = []): FlattenResult {
    const episode = new Set(Array.from(episodeKeys, (k) => k.toLowerCase()));
    const lines: FlattenedLine[] = [];
    const skippedEntries: string[] = [];

    for (const entry of this.#entries) {
      if (wordsOf(entry).some((w) => episode.has(w.toLowerCase()))) {
        skippedEntries.push(entry.key);
        continue;
      }
      lines.push(...flattenEntry(entry));
    }

    return { lines, text: lines.map(renderLine).join('\n'), skippedEntries };
  }

  /** Wpisy gotowe do dopasowania (`ResolvedLexicon.entries`, `origin: 'series'`). */
  toLexiconEntries(episodeKeys: Iterable<string> = []): LexiconEntry[] {
    const result: LexiconEntry[] = [];
    let comment: string | undefined;

    for (const line of this.flatten(episodeKeys).lines) {
      if (line.type === 'comment') {
        comment = line.text;
        continue;
      }
      result.push(toLexiconEntry(line, comment));
      comment = undefined;
    }
    return result;
  }

  /**
   * Przygotowuje napisy do Koko-Pack: dopisuje spłaszczony leksykon po wpisach
   * odcinka i ustawia `SeriesLexicon = none` (paczka samowystarczalna).
   */
  embedInto(ass: KokoAss): FlattenResult {
    const flat = this.flatten(ass.lexicon.map((e) => e.key));

    ass.appendLines(
      'Koko Lexicon',
      flat.lines.map((l) =>
        l.type === 'comment'
          ? { type: 'comment', text: ` ${l.text}` }
          : { type: 'entry', key: l.stem ? `${l.word}*` : l.word, value: l.value },
      ),
    );
    ass.set('Koko Rules', 'SeriesLexicon', 'none');

    return flat;
  }

  // ─── Zapis ────────────────────────────────────────────────────────────────

  /** TOML z wpisami w kolejności kodów Unicode (stabilne diffy). */
  toString(): string {
    const entries = Object.fromEntries(
      Object.keys(this.#raw).sort(compareCodePoints).map((key) => [key, this.#raw[key]]),
    );
    return stringify({
      format: SERIES_LEXICON_FORMAT,
      version: SERIES_LEXICON_VERSION,
      ...(this.#title !== undefined && { title: this.#title }),
      entries,
    });
  }

  #revalidate(): void {
    const { entries, diagnostics } = validateEntries(this.#raw);
    this.#entries = entries;
    this.#entryDiagnostics = diagnostics;
  }
}

// ─── Pomocnicze ─────────────────────────────────────────────────────────────

const wordsOf = (e: ValidatedSeriesEntry): string[] => [e.key, ...e.aliases, ...e.forms.map((f) => f.form)];

const valueText = (v: LexiconValue): string => (v.kind === 'ipa' ? v.ipa : FLATTEN_RESPELL_PREFIX + v.text);

/** `; notatka (sprawdzone)` → klucz → aliasy → formy. */
function flattenEntry(entry: ValidatedSeriesEntry): FlattenedLine[] {
  const lines: FlattenedLine[] = [];
  const note = entry.note?.replace(/\r?\n/g, ' ').trim();

  if (note) lines.push({ type: 'comment', text: entry.verified ? note + FLATTEN_VERIFIED_SUFFIX : note });
  else if (entry.verified) lines.push({ type: 'comment', text: FLATTEN_VERIFIED_ONLY });

  const line = (role: FlattenedEntryLine['role'], word: string, stem: boolean, value: LexiconValue): FlattenedEntryLine =>
    ({ type: 'entry', role, entryKey: entry.key, word, stem, value: valueText(value) });

  lines.push(line('key', entry.key, entry.stem, entry.value));
  for (const alias of entry.aliases) lines.push(line('alias', alias, entry.stem, entry.value));
  for (const { form, value } of entry.forms) lines.push(line('form', form, false, value));

  return lines;
}

function renderLine(line: FlattenedLine): string {
  if (line.type === 'comment') return `; ${line.text}`;
  return `${line.word}${line.stem ? '*' : ''} = ${line.value}`;
}

function toLexiconEntry(line: FlattenedEntryLine, comment: string | undefined): LexiconEntry {
  const words = line.word.split(/\s+/).filter(Boolean);
  const value: LexiconValue = line.value.startsWith(FLATTEN_RESPELL_PREFIX)
    ? { kind: 'respell', text: line.value.slice(FLATTEN_RESPELL_PREFIX.length) }
    : { kind: 'ipa', ipa: line.value };

  return {
    key: words.join(' '),
    words,
    stem: line.stem,
    value,
    origin: 'series',
    seriesEntryKey: line.entryKey,
    ...(comment !== undefined && { comment }),
  };
}
