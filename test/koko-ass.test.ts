import { describe, expect, it } from 'vitest';
import { type } from 'arktype';
import { KokoAss, LEKTOR_VALUES, RULES_VALUES, formatAssTime, parseAssTime, parseKokoAss } from '../src/koko-ass/index.js';
import type { KkDiagnosticOf } from '../src/types/index.js';
import { codes, fixture } from './helpers.js';

const minimal = (body: string) => `[Script Info]\nScriptType: v4.00+\nKokoAnime Version: 1\n\n${body}`;

describe('parseKokoAss', () => {
  it('przykład ze specyfikacji (§7) nie daje diagnostyk', () => {
    const { document, diagnostics } = parseKokoAss(fixture('spec-example.ass'));

    expect(diagnostics).toEqual([]);
    expect(document.lektor).toMatchObject({ voice: 'pl_lektor_1', duck: -12, speed: 1 });
    expect(document.rules).toMatchObject({ skipStyles: ['Sign', 'OP*'], skipIfNoActor: true, maxSpeed: 1.3 });
    expect(document.styles).toEqual([{ pattern: 'Italics', skip: false, line: 17, mode: 'thought', gain: -1 }]);
    expect(document.lexicon.map((e) => [e.key, e.stem, e.value.kind])).toEqual([
      ['Jinshi', false, 'ipa'],
      ['Gyokuyou', true, 'respell'],
    ]);
    expect(document.events).toHaveLength(11);
    expect(document.assStyles.find((s) => s.name === 'Italics')?.italic).toBe(true);
  });

  it('dzieli klucz na pierwszym "=" i rozpoznaje sekcje bez względu na wielkość liter', () => {
    const { document, diagnostics } = parseKokoAss(minimal('[koko lexicon]\nJinshi = dʑin=ɕi\n'));
    expect(diagnostics).toEqual([]);
    expect(document.lexicon[0]?.value).toEqual({ kind: 'ipa', ipa: 'dʑin=ɕi' });
    expect(document.rawSections[0]?.name).toBe('Koko Lexicon');
  });

  it('powtórzony klucz: wygrywa ostatni', () => {
    const { document } = parseKokoAss(minimal('[Koko Lektor]\nSpeed = 1.2\nspeed = 0.9\n'));
    expect(document.lektor.speed).toBe(0.9);
  });

  it('zgłasza KK001, KK002 i KK006 z danymi', () => {
    const { diagnostics } = parseKokoAss(
      '[Script Info]\nKokoAnime Version: 2\n[Koko Lektor]\nSpeed = 5\nFoo = 1\n[Koko Rules]\nSkipIfEffect = constructor\n',
    );
    expect(codes(diagnostics)).toEqual(['KK002', 'KK006', 'KK001', 'KK006']);

    const speed = diagnostics.find((d): d is KkDiagnosticOf<'KK006'> => d.code === 'KK006');
    expect(speed?.data).toEqual({ key: 'Speed', value: '5' });
  });

  it('nie traci przecinków ani dwukropków w polu Text', () => {
    const { document } = parseKokoAss(
      minimal('[Events]\nFormat: Layer, Start, End, Style, Actor, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.50,0:00:02.00,Default,Jin,0,0,0,,Tak, nie: może\n'),
    );
    expect(document.events[0]).toMatchObject({ start: 1500, end: 2000, name: 'Jin', text: 'Tak, nie: może' });
  });
});

describe('walidacja wartości (arktype)', () => {
  it('KK006 niesie opis błędu ze schematu', () => {
    const { diagnostics } = parseKokoAss(minimal('[Koko Lektor]\nSpeed = 5\nDuck = 3\n[Koko Rules]\nSkipIfMatch = (\n'));
    expect(diagnostics.map((d) => d.message)).toEqual([
      'must be at most 2 (was 5)',
      'must be non-positive (was 3)',
      'must be a valid regular expression (u flag) (was "(")',
    ]);
  });

  it('czytniki są dostępne osobno — np. do walidacji pól w edytorze', () => {
    expect(LEKTOR_VALUES.speed('1.25')).toEqual({ speed: 1.25 });
    expect(RULES_VALUES.numbers('AUTO')).toEqual({ numbers: 'auto' });
    expect(RULES_VALUES.skipifeffect('tak')).toEqual({ skipIfEffect: true });
    expect(LEKTOR_VALUES.speed('1e0')).toBeInstanceOf(type.errors);
  });

  it('KK007 dla źródła bez hasha i z niecałkowitym rozmiarem', () => {
    const { document, diagnostics } = parseKokoAss(minimal('[Koko Sources]\nA = file=x size=1\nB = btih=3f8a1c07d4e2b9a6c58f10e3d7b2a49c6e1f9e02 file=x size=1.5\n'));
    expect(codes(diagnostics)).toEqual(['KK007', 'KK007']);
    expect(document.sources).toEqual([]);
  });
});

describe('KokoAss', () => {
  it('zapis jest stabilny', () => {
    const text = KokoAss.parse(fixture('spec-example.ass')).toString();
    expect(KokoAss.parse(text).toString()).toBe(text);
  });

  it('zachowuje CRLF i BOM', () => {
    const text = '\uFEFF[Script Info]\r\nScriptType: v4.00+\r\n\r\n[Events]\r\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\r\n';
    const out = KokoAss.parse(text).toString();
    expect(out.startsWith('\uFEFF')).toBe(true);
    expect(out).toContain('\r\n');
    expect(out).not.toMatch(/[^\r]\n/);
  });

  it('set/remove przeliczają konfigurację i diagnostyki', () => {
    const ass = KokoAss.parse(fixture('spec-example.ass'));

    ass.set('Koko Lektor', 'Speed', '9');
    expect(codes(ass.diagnostics)).toEqual(['KK006']);

    ass.set('Koko Lektor', 'speed', '1.1');
    expect(ass.lektor.speed).toBe(1.1);
    expect(ass.diagnostics).toEqual([]);

    ass.remove('Koko Rules', 'MaxSpeed');
    expect(ass.rules.maxSpeed).toBe(1);
  });

  it('nowe sekcje Koko trafiają w kolejności ze specyfikacji, przed [V4+ Styles]', () => {
    const ass = KokoAss.create();
    ass.set('Koko Lexicon', 'Maomao*', '~Maomao');
    ass.set('Koko Lektor', 'Voice', 'pl_lektor_1');

    const headers = ass.toString().match(/^\[.+\]$/gm);
    expect(headers).toEqual(['[Script Info]', '[Koko Lektor]', '[Koko Lexicon]', '[V4+ Styles]', '[Events]']);
  });
});

describe('czasy ASS', () => {
  it('parsuje i formatuje', () => {
    expect(parseAssTime('1:02:03.45')).toBe(3_723_450);
    expect(parseAssTime('0:00:01.5')).toBe(1500);
    expect(parseAssTime('x')).toBeNull();
    expect(formatAssTime(13_105)).toBe('0:00:13.11');
  });
});
