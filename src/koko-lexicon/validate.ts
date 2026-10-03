/**
 * Walidacja tabeli `entries` z `koko-lexicon.toml` (Koko-Lexicon v1, §1 i §4).
 * Surowe dane z TOML → wpisy po walidacji + diagnostyki KL003–KL006.
 */
import { type } from 'arktype';
import { KL_DIAGNOSTICS, LEXICON_FORBIDDEN_CHARS, SERIES_LEXICON_ENTRY_FIELDS } from '../types/index.js';
import type {
  Kl004Target, KlCode, KlDiagnostic, KlDiagnosticData, KlDiagnosticOf, LexiconValue, LexiconWordRole, ValidatedSeriesEntry,
} from '../types/index.js';
import { ENTRY_FIELDS, FORM_VALUE } from './schemas.js';

// ─── Diagnostyka ────────────────────────────────────────────────────────────

type DataArgs<C extends KlCode> = C extends keyof KlDiagnosticData ? [data: KlDiagnosticData[C]] : [];

export function kl<C extends KlCode>(code: C, message: string, ...data: DataArgs<C>): KlDiagnosticOf<C> {
  const diagnostic = { code, level: KL_DIAGNOSTICS[code].level, message, ...(data.length > 0 && { data: data[0] }) };
  return diagnostic as unknown as KlDiagnosticOf<C>;
}

// ─── Porządek ───────────────────────────────────────────────────────────────

/** Porządek kodów Unicode (nie jednostek UTF-16 jak domyślne `sort`). */
export function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a, (c) => c.codePointAt(0)!);
  const y = Array.from(b, (c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i]! - y[i]!;
  }
  return x.length - y.length;
}

export const byCodePoints = <T>(get: (item: T) => string) => (a: T, b: T) => compareCodePoints(get(a), get(b));

// ─── Wpisy ──────────────────────────────────────────────────────────────────

/** Pierwszy niedozwolony znak albo `'empty'`; `null`, gdy słowo jest poprawne. */
function wordProblem(word: string): (typeof LEXICON_FORBIDDEN_CHARS)[number] | 'empty' | null {
  if (word.trim() === '') return 'empty';
  return LEXICON_FORBIDDEN_CHARS.find((c) => word.includes(c)) ?? null;
}

function wordError(word: string, target: Kl004Target): KlDiagnostic | null {
  const problem = wordProblem(word);
  if (problem === null) return null;
  const reason = problem === 'empty' ? { reason: 'empty' as const } : { reason: 'forbiddenChar' as const, char: problem };
  return kl('KL004', `Niepoprawne słowo „${word}”`, { ...target, ...reason });
}

export function validateEntries(table: Record<string, unknown>): {
  entries: ValidatedSeriesEntry[];
  diagnostics: KlDiagnostic[];
} {
  const diagnostics: KlDiagnostic[] = [];
  const entries: ValidatedSeriesEntry[] = [];

  for (const key of Object.keys(table).sort(compareCodePoints)) {
    const entry = validateEntry(key, table[key], diagnostics);
    if (entry) entries.push(entry);
  }

  resolveCollisions(entries, diagnostics);

  for (const entry of entries) {
    if (!entry.verified) diagnostics.push(kl('KL006', `${entry.key}: niesprawdzone`, { entryKey: entry.key }));
  }

  return { entries, diagnostics };
}

function validateEntry(key: string, raw: unknown, diagnostics: KlDiagnostic[]): ValidatedSeriesEntry | null {
  const entryTarget = { kind: 'entry' as const, entryKey: key };
  const keyError = wordError(key, entryTarget);
  if (keyError) {
    diagnostics.push(keyError);
    return null;
  }

  // ─── Typy pól (arktype) ───────────────────────────────────────────────────

  const fields = ENTRY_FIELDS(raw);
  if (fields instanceof type.errors) {
    const field = String(fields[0]?.path[0] ?? '(wpis)');
    diagnostics.push(kl('KL004', `${key}: ${fields.summary}`, { ...entryTarget, reason: 'type', field }));
    return null;
  }

  for (const field of Object.keys(raw as object)) {
    if (!(SERIES_LEXICON_ENTRY_FIELDS as readonly string[]).includes(field)) {
      diagnostics.push(kl('KL003', `${key}: nieznane pole ${field}`, { entryKey: key, field }));
    }
  }

  // ─── Wymowa: dokładnie jedno z ipa / respell ──────────────────────────────

  const { ipa, respell, stem = false, aliases = [], forms = {}, note, verified = false } = fields;
  if (ipa !== undefined && respell !== undefined) {
    diagnostics.push(kl('KL004', `${key}: ipa i respell naraz`, { ...entryTarget, reason: 'pronunciation', found: 'both' }));
    return null;
  }

  const pronunciation = ipa ?? respell;
  if (pronunciation === undefined) {
    diagnostics.push(kl('KL004', `${key}: brak ipa i respell`, { ...entryTarget, reason: 'pronunciation', found: 'none' }));
    return null;
  }
  if (pronunciation.trim() === '') {
    diagnostics.push(kl('KL004', `${key}: pusta wymowa`, { ...entryTarget, reason: 'empty' }));
    return null;
  }

  const kind = ipa !== undefined ? 'ipa' : 'respell';
  const toValue = (text: string): LexiconValue => (kind === 'ipa' ? { kind, ipa: text } : { kind, text });

  const validAliases = aliases.filter((alias) => {
    const error = wordError(alias, { kind: 'alias', entryKey: key, alias });
    if (error) diagnostics.push(error);
    return !error;
  });

  const validForms: ValidatedSeriesEntry['forms'] = [];
  for (const form of Object.keys(forms).sort(compareCodePoints)) {
    const target = { kind: 'form' as const, entryKey: key, form };
    const error = wordError(form, target);
    const value = FORM_VALUE(forms[form]);

    if (error) diagnostics.push(error);
    else if (value instanceof type.errors) diagnostics.push(kl('KL004', `${key}: forma ${form} ${value.summary}`, { ...target, reason: 'type', field: form }));
    else if (value.trim() === '') diagnostics.push(kl('KL004', `${key}: pusta forma ${form}`, { ...target, reason: 'empty' }));
    else validForms.push({ form, value: toValue(value) });
  }

  return {
    key,
    value: toValue(pronunciation),
    stem,
    aliases: validAliases,
    forms: validForms,
    verified,
    ...(note !== undefined && { note }),
  };
}

/**
 * KL005: każde słowo (bez rozróżniania wielkości liter) tylko w jednym wpisie.
 * Słowo zostaje przy wpisie o pierwszym kluczu wg kodów Unicode; wpis, którego
 * KLUCZ jest zajęty, odpada w całości (nie może istnieć bez klucza).
 */
function resolveCollisions(entries: ValidatedSeriesEntry[], diagnostics: KlDiagnostic[]): void {
  const owners = new Map<string, string>();

  const claim = (word: string, entryKey: string, role: LexiconWordRole): boolean => {
    const lower = word.toLowerCase();
    const owner = owners.get(lower);
    if (owner === undefined) {
      owners.set(lower, entryKey);
      return true;
    }
    diagnostics.push(kl('KL005', `„${word}” już we wpisie ${owner}`, { word, keptIn: owner, droppedFrom: entryKey, role }));
    return false;
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (!claim(entry.key, entry.key, 'key')) {
      entries.splice(i--, 1);
      continue;
    }
    entry.aliases = entry.aliases.filter((alias) => claim(alias, entry.key, 'alias'));
    entry.forms = entry.forms.filter(({ form }) => claim(form, entry.key, 'form'));
  }
}
