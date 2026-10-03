/**
 * Zapis `KokoAssDocument` z powrotem do tekstu `.ass` — odwrotność parsera.
 * Kolejność sekcji, linie `Format:`, końce linii i BOM pochodzą z `layout`.
 */
import type { AssEvent, KokoAssDocument, KokoAssLayout, RawKokoSection, SectionSlot } from '../types/index.js';
import { toField } from './parser/index.js';

export function writeKokoAss(doc: KokoAssDocument, layout: KokoAssLayout): string {
  const { eol, bom } = layout.format;

  const blocks = layout.order
    .map((slot) => writeSection(slot, doc, layout))
    .filter((lines): lines is string[] => lines !== null)
    .map((lines) => lines.join(eol));

  return (bom ? '\uFEFF' : '') + blocks.join(eol + eol) + eol;
}

function writeSection(slot: SectionSlot, doc: KokoAssDocument, layout: KokoAssLayout): string[] | null {
  switch (slot.kind) {
    case 'scriptInfo':
      return writeScriptInfo(doc);

    case 'koko': {
      const raw = doc.rawSections.find((s) => s.name === slot.name);
      return raw ? writeKokoSection(raw) : null;
    }

    case 'styles':
      return writeTable('V4+ Styles', layout.assFormats.styles, doc.assStyles.map((style) => ['Style', style]));

    case 'events':
      return [
        ...writeTable('Events', layout.assFormats.events, doc.events.map((event) => [event.kind, withAssTimes(event)])),
        ...layout.extraEventLines,
      ];

    case 'other': {
      const section = doc.otherSections[slot.index];
      if (!section) return null;
      return section.text ? [`[${section.name}]`, section.text] : [`[${section.name}]`];
    }
  }
}

// ─── Sekcje ─────────────────────────────────────────────────────────────────

function writeScriptInfo({ scriptInfo: info }: KokoAssDocument): string[] {
  const lines = ['[Script Info]', `ScriptType: ${info.scriptType}`];

  if (info.playResX !== undefined) lines.push(`PlayResX: ${info.playResX}`);
  if (info.playResY !== undefined) lines.push(`PlayResY: ${info.playResY}`);
  for (const [key, value] of Object.entries(info.other)) lines.push(`${key}: ${value}`);
  if (info.kokoAnimeVersion !== null) lines.push(`KokoAnime Version: ${info.kokoAnimeVersion}`);

  return lines;
}

function writeKokoSection(raw: RawKokoSection): string[] {
  const lines = raw.lines.map((l) => (l.type === 'comment' ? `;${l.text}` : `${l.key} = ${l.value}`));
  return [`[${raw.name}]`, ...lines];
}

/** `[Nazwa]`, `Format: …` i wiersze `Rodzaj: pola` w kolejności kolumn z `Format:`. */
function writeTable(name: string, format: readonly string[], rows: [kind: string, row: object][]): string[] {
  return [
    `[${name}]`,
    `Format: ${format.join(', ')}`,
    ...rows.map(([kind, row]) => `${kind}: ${format.map((column) => writeField(row, column)).join(',')}`),
  ];
}

function writeField(row: object, column: string): string {
  const value: unknown = Reflect.get(row, toField(column));
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? '-1' : '0'; // ASS: -1 = prawda
  return String(value);
}

/** Zdarzenie z czasami w zapisie ASS zamiast ms. */
function withAssTimes(event: AssEvent) {
  return { ...event, start: formatAssTime(event.start), end: formatAssTime(event.end) };
}

/** ms → `H:MM:SS.cc` (ASS zapisuje setne sekundy). */
export function formatAssTime(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const pad = (n: number) => String(n).padStart(2, '0');

  const h = Math.floor(cs / 360_000);
  const m = Math.floor(cs / 6_000) % 60;
  const s = Math.floor(cs / 100) % 60;

  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
}
