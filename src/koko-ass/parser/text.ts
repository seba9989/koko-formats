/** Warstwa tekstowa: plik → sekcje → surowe linie `[Koko …]`. */
import type { KokoSectionName, RawKeyValueLine, RawKokoSection, RawSectionLine, TextFileFormat, TextSection } from '../../types/index.js';
import { COMMENT, KOKO_ENTRY, NEWLINE, SECTION_HEADER } from './patterns.js';
import type { Report } from './util.js';

export function splitSections(input: string): { sections: TextSection[]; format: TextFileFormat } {
  const bom = input.startsWith('\uFEFF');
  const body = bom ? input.slice(1) : input;
  const format: TextFileFormat = { bom, eol: body.includes('\r\n') ? '\r\n' : '\n' };

  const sections: TextSection[] = [];
  body.split(NEWLINE).forEach((raw, i) => {
    const text = raw.trim();
    const line = i + 1;
    const header = SECTION_HEADER.exec(text);

    if (header) sections.push({ name: header.groups.name.trim(), line, lines: [] });
    else if (text !== '') sections.at(-1)?.lines.push({ text, line });
  });

  return { sections, format };
}

export function parseKokoSection(section: TextSection, name: KokoSectionName, report: Report): RawKokoSection {
  const lines: RawSectionLine[] = [];

  for (const { text, line } of section.lines) {
    const comment = COMMENT.exec(text);
    if (comment) {
      lines.push({ type: 'comment', text: comment.groups.text, line });
      continue;
    }

    const entry = KOKO_ENTRY.exec(text);
    if (!entry) {
      report('KK006', line, { key: text, value: '' });
      continue;
    }

    lines.push({ type: 'entry', key: entry.groups.key.trim(), value: entry.groups.value.trim(), line });
  }

  return { name, line: section.line, lines };
}

/** Same wpisy `klucz = wartość`, bez komentarzy. */
export function entries(raw: RawKokoSection | undefined): RawKeyValueLine[] {
  return (raw?.lines ?? []).filter((l): l is RawKeyValueLine => l.type === 'entry');
}
