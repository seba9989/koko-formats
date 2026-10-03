/** Znaczenie sekcji `[Koko …]`: surowe wpisy → konfiguracja z domyślnymi. */
import { type } from 'arktype';
import type { ArkErrors } from 'arktype';
import {
  KOKO_LEKTOR_DEFAULTS, KOKO_LEKTOR_KEYS, KOKO_RULES_DEFAULTS, KOKO_RULES_KEYS, KOKO_SOURCE_FIELDS,
  KOKO_STYLE_PARAMS, KOKO_STYLE_SKIP,
} from '../../types/index.js';
import type {
  KokoLektor, KokoLektorKey, KokoRules, KokoRulesKey, KokoSource, KokoSources, KokoStyleModifiers, KokoStyles,
  LexiconEntry, RawKokoSection, SourcePairs,
} from '../../types/index.js';
import { LEXICON_KEY, LEXICON_VALUE, SOURCE_PAIR, STYLE_PARAM } from './patterns.js';
import { LEKTOR_VALUES, RULES_VALUES, SOURCE_FIELDS, STYLE_PARAM_VALUES } from './schemas.js';
import type { ValueReader } from './schemas.js';
import { entries } from './text.js';
import { isOneOf } from './util.js';
import type { Report } from './util.js';

// ─── Wspólny wzorzec: domyślne + nadpisz ────────────────────────────────────

interface KeyedSection<T, K extends string> {
  raw: RawKokoSection | undefined;
  report: Report;
  defaults: T;
  keys: readonly K[];
  /** Czytnik wartości dla każdego klucza (schematy arktype). */
  readers: { [P in K]: ValueReader<T> };
}

/** Wspólne dla `[Koko Lektor]` i `[Koko Rules]`. Powtórzony klucz: wygrywa ostatni. */
function interpretKeyed<T extends object, K extends string>({ raw, report, defaults, keys, readers }: KeyedSection<T, K>): T {
  const result = { ...defaults };

  for (const { key, value, line } of entries(raw)) {
    const lower = key.toLowerCase();
    if (!isOneOf(keys, lower)) {
      report('KK001', line, { key });
      continue;
    }

    const patch = readers[lower](value);
    if (patch instanceof type.errors) report('KK006', line, { key, value }, patch.summary);
    else Object.assign(result, patch);
  }

  return result;
}

// ─── [Koko Lektor] i [Koko Rules] ───────────────────────────────────────────

export function interpretLektor(raw: RawKokoSection | undefined, report: Report): KokoLektor {
  return interpretKeyed<KokoLektor, KokoLektorKey>({
    raw, report, defaults: KOKO_LEKTOR_DEFAULTS, keys: KOKO_LEKTOR_KEYS, readers: LEKTOR_VALUES,
  });
}

export function interpretRules(raw: RawKokoSection | undefined, report: Report): KokoRules {
  return interpretKeyed<KokoRules, KokoRulesKey>({
    raw, report, defaults: KOKO_RULES_DEFAULTS, keys: KOKO_RULES_KEYS, readers: RULES_VALUES,
  });
}

// ─── [Koko Styles] ──────────────────────────────────────────────────────────

/** Kolejność zachowana — pierwszy pasujący wpis wygrywa. */
export function interpretStyles(raw: RawKokoSection | undefined, report: Report): KokoStyles {
  const styles: KokoStyles = [];

  for (const { key: pattern, value, line } of entries(raw)) {
    if (value.toLowerCase() === KOKO_STYLE_SKIP) {
      styles.push({ pattern, skip: true, line });
      continue;
    }

    const params = value.split(/\s+/).filter(Boolean);
    if (params.length === 0) {
      report('KK006', line, { key: pattern, value });
      continue;
    }

    const rule: KokoStyleModifiers = { pattern, skip: false, line };

    for (const param of params) {
      const match = STYLE_PARAM.exec(param);
      if (!match) {
        report('KK006', line, { key: pattern, value: param });
        continue;
      }

      const { key, value: paramValue } = match.groups;
      const lower = key.toLowerCase();
      if (!isOneOf(KOKO_STYLE_PARAMS, lower)) {
        report('KK001', line, { key });
        continue;
      }

      const patch = STYLE_PARAM_VALUES[lower](paramValue);
      if (patch instanceof type.errors) report('KK006', line, { key, value: paramValue }, patch.summary);
      else Object.assign(rule, patch);
    }

    // Reguła z częściowo błędnymi parametrami zostaje — nadal blokuje późniejsze wpisy.
    styles.push(rule);
  }

  return styles;
}

// ─── [Koko Lexicon] ─────────────────────────────────────────────────────────

export function interpretLexicon(raw: RawKokoSection | undefined, report: Report): LexiconEntry[] {
  const lexicon: LexiconEntry[] = [];
  let comment: string | undefined;

  for (const l of raw?.lines ?? []) {
    if (l.type === 'comment') {
      comment = l.text.trim();
      continue;
    }

    const entry = readLexiconEntry(l.key, l.value, l.line, comment);
    if (entry) lexicon.push(entry);
    else report('KK006', l.line, { key: l.key, value: l.value });

    comment = undefined; // komentarz dotyczy tylko wpisu bezpośrednio pod nim
  }

  return lexicon;
}

function readLexiconEntry(rawKey: string, rawValue: string, line: number, comment: string | undefined): LexiconEntry | null {
  const key = LEXICON_KEY.exec(rawKey);
  const value = LEXICON_VALUE.exec(rawValue);
  if (!key || !value) return null;

  const words = key.groups.key.trim().split(/\s+/).filter(Boolean);
  const text = value.groups.text.trim();
  if (words.length === 0 || text === '') return null;

  return {
    key: words.join(' '),
    words,
    stem: key.groups.stem !== undefined,
    value: value.groups.respell !== undefined ? { kind: 'respell', text } : { kind: 'ipa', ipa: text },
    origin: 'episode',
    line,
    ...(comment !== undefined && { comment }),
  };
}

// ─── [Koko Sources] ─────────────────────────────────────────────────────────

export function interpretSources(raw: RawKokoSection | undefined, report: Report): KokoSources {
  const sources: KokoSources = [];

  for (const { key: label, value, line } of entries(raw)) {
    const pairs = parsePairs(value);
    if (!pairs) {
      report('KK007', line, { label });
      continue;
    }

    for (const field of pairs.keys()) {
      if (!isOneOf(KOKO_SOURCE_FIELDS, field)) report('KK001', line, { key: field });
    }

    const source = readSource(label, pairs, line);
    if (source instanceof type.errors) report('KK007', line, { label }, source.summary);
    else sources.push(source);
  }

  return sources;
}

/** `k=v k="v v"` → mapa; `null` przy błędzie składni. */
function parsePairs(value: string): SourcePairs | null {
  const pairs = new Map<string, string>();

  for (let pos = 0; pos < value.length; pos = SOURCE_PAIR.lastIndex) {
    SOURCE_PAIR.lastIndex = pos;
    const match = SOURCE_PAIR.exec(value);
    if (!match) return null;
    pairs.set(match.groups.key.toLowerCase(), match.groups.quoted ?? match.groups.bare);
  }

  return pairs;
}

/** Walidacja pól wpisu schematem `SOURCE_FIELDS`; błędy → KK007. */
function readSource(label: string, pairs: SourcePairs, line: number): KokoSource | ArkErrors {
  const fields = SOURCE_FIELDS(Object.fromEntries(pairs));
  if (fields instanceof type.errors) return fields;

  const { btih, btmh, file, size, name, fingerprint } = fields;
  const hashes = btmh !== undefined ? { btmh, ...(btih !== undefined && { btih }) } : { btih: btih! };

  return {
    ...hashes,
    label,
    file,
    size,
    line,
    ...(name !== undefined && { name }),
    ...(fingerprint !== undefined && { fingerprint }),
  };
}
