/**
 * Wszystkie wyrażenia regularne parsera. Typy grup i zawężenia `.test()`
 * wynikają z samych wzorców (arkregex).
 */
import { regex } from 'arkregex';

// ─── Struktura pliku ────────────────────────────────────────────────────────

export const NEWLINE = regex('\r?\n');
export const SECTION_HEADER = regex('^\\[(?<name>.+)\\]$');
export const COMMENT = regex('^;(?<text>.*)$');

/** `klucz = wartość` — `[^=]*` zatrzymuje się na pierwszym `=`. */
export const KOKO_ENTRY = regex('^(?<key>[^=]*)=(?<value>.*)$');

/** `Klucz: wartość` — `[^:]+` zatrzymuje się na pierwszym `:`. */
export const COLON_LINE = regex('^(?<key>[^:]+):(?<value>.*)$');

// ─── Wartości ───────────────────────────────────────────────────────────────

export const ASS_TIME = regex('^(?<h>\\d+):(?<m>\\d{1,2}):(?<s>\\d{1,2})[.,](?<frac>\\d{1,3})$');

// ─── [Koko Styles] ──────────────────────────────────────────────────────────

export const STYLE_PARAM = regex('^(?<key>[A-Za-z]\\w*)=(?<value>\\S*)$');

// ─── [Koko Lexicon] ─────────────────────────────────────────────────────────

export const LEXICON_KEY = regex('^(?<key>.*?)(?<stem>\\*)?$');
export const LEXICON_VALUE = regex('^(?<respell>~)?(?<text>.*)$');

// ─── [Koko Sources] ─────────────────────────────────────────────────────────

/** Jedna para `k=v` lub `k="v v"`. Flaga `y`: dopasowanie dokładnie od `lastIndex`. */
export const SOURCE_PAIR = regex('\\s*(?<key>[A-Za-z]\\w*)=(?:"(?<quoted>[^"{}]*)"|(?<bare>[^\\s"{}]+))\\s*', 'y');
