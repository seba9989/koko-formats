/** Standardowe sekcje ASS: `[Script Info]`, `[V4+ Styles]`, `[Events]`. */
import { type } from 'arktype';
import {
  ASS_EVENT_DEFAULTS, ASS_EVENT_NUMBER_FIELDS, ASS_EVENT_STRING_FIELDS, ASS_EVENT_TIME_FIELDS,
  ASS_STYLE_BOOL_FIELDS, ASS_STYLE_DEFAULTS, ASS_STYLE_NUMBER_FIELDS, ASS_STYLE_STRING_FIELDS,
  KOKO_ASS_VERSION,
} from '../../types/index.js';
import type { AssEvent, AssEventKind, AssStyle, KokoAssLayout, ScriptInfo, TextSection } from '../../types/index.js';
import { ASS_TIME, COLON_LINE, COMMENT } from './patterns.js';
import { KOKO_VERSION } from './schemas.js';
import { isOneOf, splitN, toField } from './util.js';
import type { Report } from './util.js';

const EVENT_KINDS = ['Dialogue', 'Comment'] as const satisfies readonly AssEventKind[];

// ─── [Script Info] ──────────────────────────────────────────────────────────

export function parseScriptInfo(section: TextSection, report: Report): ScriptInfo {
  const info: ScriptInfo = { scriptType: 'v4.00+', kokoAnimeVersion: null, other: {} };

  for (const { text, line } of section.lines) {
    if (COMMENT.test(text)) continue;
    const match = COLON_LINE.exec(text);
    if (!match) continue;

    const key = match.groups.key.trim();
    const value = match.groups.value.trim();

    switch (key.toLowerCase()) {
      case 'scripttype':
        break; // zawsze v4.00+
      case 'playresx':
        info.playResX = Number(value);
        break;
      case 'playresy':
        info.playResY = Number(value);
        break;
      case 'kokoanime version':
        readKokoVersion(info, key, value, line, report);
        break;
      default:
        info.other[key] = value;
    }
  }

  return info;
}

function readKokoVersion(info: ScriptInfo, key: string, value: string, line: number, report: Report): void {
  const version = KOKO_VERSION(value);
  if (version instanceof type.errors) {
    report('KK006', line, { key, value }, version.summary);
    return;
  }

  info.kokoAnimeVersion = version;
  if (version > KOKO_ASS_VERSION) {
    report('KK002', line, { found: version, supported: KOKO_ASS_VERSION });
  }
}

// ─── [V4+ Styles] ───────────────────────────────────────────────────────────

export function parseAssStyles(section: TextSection, layout: KokoAssLayout): AssStyle[] {
  const styles: AssStyle[] = [];

  for (const { text } of section.lines) {
    if (COMMENT.test(text)) continue;
    const match = COLON_LINE.exec(text);
    if (!match) continue;

    const kind = match.groups.key.trim().toLowerCase();
    const value = match.groups.value;

    if (kind === 'format') layout.assFormats.styles = readFormat(value);
    else if (kind === 'style') styles.push(readStyle(value, layout.assFormats.styles));
  }

  return styles;
}

function readStyle(value: string, format: readonly string[]): AssStyle {
  const style: AssStyle = { ...ASS_STYLE_DEFAULTS };

  splitN(value, format.length).forEach((raw, i) => {
    const field = toField(format[i]!);
    const v = raw.trim();

    if (isOneOf(ASS_STYLE_STRING_FIELDS, field)) style[field] = v;
    else if (isOneOf(ASS_STYLE_BOOL_FIELDS, field)) style[field] = v !== '0' && v !== ''; // ASS: -1 = prawda
    else if (isOneOf(ASS_STYLE_NUMBER_FIELDS, field)) style[field] = Number(v) || 0;
    // nieznana kolumna — ignorowana
  });

  return style;
}

// ─── [Events] ───────────────────────────────────────────────────────────────

export function parseEvents(section: TextSection, layout: KokoAssLayout, report: Report): AssEvent[] {
  const events: AssEvent[] = [];

  for (const { text, line } of section.lines) {
    const match = COLON_LINE.exec(text);
    const kind = match?.groups.key.trim() ?? '';
    const value = match?.groups.value ?? '';

    if (kind.toLowerCase() === 'format') layout.assFormats.events = readFormat(value);
    else if (isOneOf(EVENT_KINDS, kind)) events.push(readEvent(kind, value, line, layout.assFormats.events, report));
    else layout.extraEventLines.push(text); // Picture/Sound/Movie/Command, komentarze
  }

  return events;
}

function readEvent(kind: AssEventKind, value: string, line: number, format: readonly string[], report: Report): AssEvent {
  const event: AssEvent = { ...ASS_EVENT_DEFAULTS, kind, line };

  splitN(value, format.length).forEach((raw, i) => {
    const column = format[i]!;
    const field = toField(column);
    const v = field === 'text' ? raw : raw.trim(); // Text bez zmian — także spacje

    if (isOneOf(ASS_EVENT_TIME_FIELDS, field)) {
      const ms = parseAssTime(v);
      if (ms === null) report('KK006', line, { key: column, value: v });
      event[field] = ms ?? 0;
    } else if (isOneOf(ASS_EVENT_STRING_FIELDS, field)) {
      event[field] = v;
    } else if (isOneOf(ASS_EVENT_NUMBER_FIELDS, field)) {
      event[field] = Number(v) || 0;
    }
  });

  return event;
}

// ─── Wspólne ────────────────────────────────────────────────────────────────

const readFormat = (value: string): string[] => value.split(',').map((c) => c.trim());

/** `H:MM:SS.cc` → ms; `null`, gdy zapis jest niepoprawny. */
export function parseAssTime(value: string): number | null {
  const match = ASS_TIME.exec(value);
  if (!match) return null;

  const { h, m, s, frac } = match.groups;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, '0'));
}
