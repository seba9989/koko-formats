/** Schematy arktype dla struktury `koko-lexicon.toml` (Koko-Lexicon v1, §1). */
import { type } from 'arktype';
import { SERIES_LEXICON_FORMAT } from '../types/index.js';

/** Nagłówek pliku; błędy mapowane na KL001 (`missingFormat` / `missingVersion` / `missingEntries`). */
export const LEXICON_HEADER = type({
  format: type.unit(SERIES_LEXICON_FORMAT),
  version: 'number.integer > 0',
  'title?': 'string',
  entries: 'Record<string, unknown>',
});

/**
 * Typy pól wpisu (bez reguł domenowych). Reguły z osobnymi diagnostykami —
 * dokładnie jedno z ipa/respell, niedozwolone znaki, kolizje słów — sprawdza `validate.ts`.
 * Wartości `forms` sprawdzane osobno, żeby zła forma pomijała tylko siebie.
 */
export const ENTRY_FIELDS = type({
  'ipa?': 'string',
  'respell?': 'string',
  'stem?': 'boolean',
  'aliases?': 'string[]',
  'forms?': 'Record<string, unknown>',
  'note?': 'string',
  'verified?': 'boolean',
});

export const FORM_VALUE = type('string');
