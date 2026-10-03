import { describe, expect, it } from 'vitest';
import { KokoAss } from '../src/koko-ass/index.js';
import { SeriesLexicon } from '../src/koko-lexicon/index.js';
import { codes, fixture } from './helpers.js';

describe('SeriesLexicon', () => {
  it('spłaszcza dokładnie jak przykład w §3 Koko-Lexicon', () => {
    const lexicon = SeriesLexicon.parse(fixture('series-lexicon.toml'));

    expect(lexicon.flatten().text).toBe(
      [
        'Gyokuyou* = ~Giokujo',
        'Gyokuyouji = ~Giokujoji',
        '; eunuch nadzorujący pałac wewnętrzny (sprawdzone)',
        'Jinshi* = dʑinɕi',
        'Jinshiego = dʑinˈɕiɛɡɔ',
        'Jinshiemu = dʑinˈɕiɛmu',
        'Konkubina Jin = ~konkubina Dżin',
        'Konkubiny Jin = ~konkubina Dżin',
      ].join('\n'),
    );
  });

  it('KL006 dla wpisów bez verified', () => {
    const lexicon = SeriesLexicon.parse(fixture('series-lexicon.toml'));
    expect(codes(lexicon.diagnostics)).toEqual(['KL006', 'KL006']);
  });

  it('pomija wpis pokrywający się z kluczem odcinka', () => {
    const lexicon = SeriesLexicon.parse(fixture('series-lexicon.toml'));
    expect(lexicon.flatten(['gyokuyouji']).skippedEntries).toEqual(['Gyokuyou']);
  });

  it('błędny plik nie rzuca: KL001 z pozycją, KL002 dla nowszej wersji', () => {
    const broken = SeriesLexicon.parse('x = [');
    expect(broken.usable).toBe(false);
    expect(broken.diagnostics[0]).toMatchObject({ code: 'KL001', location: { line: 1 } });

    const newer = SeriesLexicon.parse('format = "koko-lexicon"\nversion = 2\n[entries]\n');
    expect(codes(newer.diagnostics)).toEqual(['KL002']);
  });

  it('KL001 z polem nagłówka, KL004 z opisem typu', () => {
    expect(SeriesLexicon.parse('format = "koko-lexicon"\n[entries]\n').diagnostics[0]?.data).toEqual({ reason: 'missingVersion' });

    const lexicon = SeriesLexicon.parse('format = "koko-lexicon"\nversion = 1\n[entries.Jinshi]\nipa = "x"\nstem = "yes"\n');
    expect(lexicon.diagnostics[0]).toMatchObject({ code: 'KL004', data: { reason: 'type', field: 'stem' } });
  });

  it('KL003, KL004 i KL005', () => {
    const lexicon = SeriesLexicon.parse(`
format = "koko-lexicon"
version = 1
[entries.Bad]
ipa = "a"
respell = "b"
[entries.Jinshi]
ipa = "dʑinɕi"
aliases = ["Jinshi-sama", "J*"]
verified = true
[entries.jinshi-sama]
ipa = "x"
color = "red"
verified = true
`);
    expect(codes(lexicon.diagnostics)).toEqual(['KL004', 'KL004', 'KL003', 'KL005']);
    expect(lexicon.entries.map((e) => e.key)).toEqual(['Jinshi']);
    expect(lexicon.find('JINSHI-SAMA')?.key).toBe('Jinshi');
  });

  it('embedInto dopisuje po wpisach odcinka i ustawia SeriesLexicon = none', () => {
    const lexicon = SeriesLexicon.parse(fixture('series-lexicon.toml'));
    const ass = KokoAss.parse(fixture('spec-example.ass'));

    const { skippedEntries } = lexicon.embedInto(ass);

    expect(skippedEntries).toEqual(['Gyokuyou', 'Jinshi']); // klucze odcinka wygrywają
    expect(ass.rules.seriesLexicon).toEqual({ kind: 'none' });
    expect(ass.lexicon.map((e) => [e.key, e.origin])).toEqual([
      ['Jinshi', 'episode'],
      ['Gyokuyou', 'episode'],
      ['Konkubina Jin', 'episode'],
      ['Konkubiny Jin', 'episode'],
    ]);
  });

  it('toString daje TOML, który wczytuje się z tymi samymi wpisami', () => {
    const lexicon = SeriesLexicon.parse(fixture('series-lexicon.toml'));
    const again = SeriesLexicon.parse(lexicon.toString());
    expect(again.entries).toEqual(lexicon.entries);
    expect(again.title).toBe('Kusuriya no Hitorigoto');
  });
});
