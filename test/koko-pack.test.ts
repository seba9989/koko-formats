import { strToU8, unzipSync, zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { KokoAss } from '../src/koko-ass/index.js';
import { SeriesLexicon } from '../src/koko-lexicon/index.js';
import { type } from 'arktype';
import { AUDIO_TRACK, KokoPack, sha256 } from '../src/koko-pack/index.js';
import type { Timeline } from '../src/types/index.js';
import { codes, fixture } from './helpers.js';

const HASH = (c: string) => `sha256:${c.repeat(64)}` as const;
const audio = crypto.getRandomValues(new Uint8Array(4000));

const timeline = (subtitlesSha256: `sha256:${string}`): Timeline => ({
  version: 1,
  audio: 'lektor',
  subtitlesSha256,
  utterances: [
    { key: HASH('a'), slot: { start: 8000, end: 10000 }, clip: { start: 8000, duration: 1400 }, baseDuration: 1400, speed: 1, delay: 0 },
  ],
});

async function createPack() {
  return KokoPack.create({
    generator: { name: 'Koko-Editor', version: '0.3.0' },
    subtitles: KokoAss.parse(fixture('spec-example.ass')),
    seriesLexicon: SeriesLexicon.parse(fixture('series-lexicon.toml')),
    lektor: {
      track: {
        id: 'lektor', path: 'audio/lektor.mp3', codec: 'mp3', sampleRate: 24000, channels: 1, bitrateMode: 'cbr',
        spliceable: true, encoderDelay: 1105, padding: 1011, offset: 0, duration: 40_000, language: 'pl',
      },
      data: audio,
    },
    timeline: timeline(HASH('0')),
    video: { name: 'odcinek.mkv', size: 1_432_523_776 },
  });
}

/** Paczka z napisami pasującymi do osi czasu. */
async function consistentPack(): Promise<Uint8Array> {
  const pack = await createPack();
  pack.setTimeline(timeline(await sha256(strToU8(pack.subtitles.toString()))));
  return pack.save();
}

/** Przepakowanie z modyfikacją (mimetype zostaje pierwszy, STORED). */
function repack(bytes: Uint8Array, change: (files: Record<string, Uint8Array>) => void): Uint8Array {
  const files = unzipSync(bytes);
  change(files);
  const zippable: Zippable = {};
  for (const [path, data] of Object.entries(files)) zippable[path] = [data, { level: path === 'mimetype' || path.startsWith('audio/') ? 0 : 6 }];
  return zipSync(zippable);
}

describe('KokoPack — zapis', () => {
  it('mimetype pierwszy i STORED, audio STORED, typ MIME pod offsetem 38', async () => {
    const bytes = await (await createPack()).save();
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(bytes.subarray(38, 73))).toBe('application/vnd.koko-anime.pack+zip');

    const entries: string[] = [];
    unzipSync(bytes, { filter: (f) => (entries.push(`${f.name}:${f.compression}`), true) });
    expect(entries).toEqual(['mimetype:0', 'manifest.json:8', 'subtitles.ass:8', 'audio/lektor.mp3:0', 'timeline.json:8']);
  });

  it('napisy w paczce mają spłaszczony leksykon serii i SeriesLexicon = none', async () => {
    const pack = await createPack();
    expect(pack.subtitles.get('Koko Rules', 'SeriesLexicon')).toBe('none');
    expect(pack.subtitles.lexicon.map((e) => e.key)).toContain('Konkubina Jin');
  });
});

describe('KokoPack — otwieranie', () => {
  it('spójna paczka otwiera się bez diagnostyk', async () => {
    const result = await KokoPack.open(await consistentPack(), { mode: 'edit' });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    if (result.ok) expect(result.pack.timeline?.utterances).toHaveLength(1);
  });

  it('KP005, gdy oś czasu nie pasuje do napisów', async () => {
    const result = await KokoPack.open(await (await createPack()).save());
    expect(codes(result.diagnostics)).toEqual(['KP005']);
  });

  it('KP001: mimetype nie jako pierwszy wpis', async () => {
    const files = unzipSync(await consistentPack());
    const bytes = zipSync({ 'manifest.json': files['manifest.json']!, mimetype: [files['mimetype']!, { level: 0 }] });
    const result = await KokoPack.open(bytes);
    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toEqual(['KP001']);
  });

  it('KP007: zip slip i nieznany plik w katalogu głównym', async () => {
    const pack = await consistentPack();
    for (const evil of ['../evil.txt', 'readme.txt']) {
      const result = await KokoPack.open(repack(pack, (f) => (f[evil] = strToU8('x'))));
      expect(result.ok).toBe(false);
      expect(codes(result.diagnostics)).toEqual(['KP007']);
    }
  });

  it('KP006 unieważnia oś czasu', async () => {
    const bytes = repack(await consistentPack(), (f) => (f['audio/lektor.mp3'] = crypto.getRandomValues(new Uint8Array(4000))));
    const result = await KokoPack.open(bytes);
    expect(codes(result.diagnostics)).toEqual(['KP006']);
    if (result.ok) expect(result.pack.timeline).toBeNull();
  });

  it('profil distribution: bez timeline.json, KP105 przy edycji', async () => {
    const opened = await KokoPack.open(await consistentPack());
    if (!opened.ok) throw new Error('nie otwarto');
    opened.pack.setProfile('distribution');

    const bytes = await opened.pack.save();
    expect(Object.keys(unzipSync(bytes))).not.toContain('timeline.json');

    const result = await KokoPack.open(bytes, { mode: 'edit' });
    expect(codes(result.diagnostics)).toEqual(['KP105']);
  });
});

describe('KokoPack — schematy (arktype)', () => {
  it('KP002 wskazuje pole, którego dotyczy błąd', async () => {
    const bytes = repack(await consistentPack(), (f) => {
      const manifest = JSON.parse(new TextDecoder().decode(f['manifest.json']));
      manifest.audio[0].channels = 3;
      f['manifest.json'] = strToU8(JSON.stringify(manifest));
    });
    const result = await KokoPack.open(bytes);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: 'KP002', message: expect.stringContaining('audio[0].channels') });
  });

  it('Opus musi mieć 48 kHz', () => {
    const track = {
      id: 'lektor', path: 'audio/lektor.opus', role: 'lektor', codec: 'opus', sampleRate: 24000, channels: 1,
      bitrateMode: 'vbr', encoderDelay: 312, padding: 0, offset: 0, duration: 1000, sha256: HASH('b'),
    };
    expect(AUDIO_TRACK(track)).toBeInstanceOf(type.errors);
    expect(AUDIO_TRACK({ ...track, sampleRate: 48000 })).not.toBeInstanceOf(type.errors);
  });

  it('nieznany kodek to KP016 (pominięcie), nie KP002', async () => {
    const bytes = repack(await consistentPack(), (f) => {
      const manifest = JSON.parse(new TextDecoder().decode(f['manifest.json']));
      manifest.audio[0].codec = 'flac';
      f['manifest.json'] = strToU8(JSON.stringify(manifest));
    });
    expect(codes((await KokoPack.open(bytes)).diagnostics)).toEqual(['KP016']);
  });
});

describe('KokoPack — wideo', () => {
  it('manifest → [Koko Sources] → brak', async () => {
    const result = await KokoPack.open(await consistentPack());
    if (!result.ok) throw new Error('nie otwarto');
    const { pack } = result;

    expect(pack.matchVideo({ name: 'odcinek.mkv', size: 1_432_523_776 }).match).toEqual({ kind: 'manifest' });
    expect(pack.matchVideo({ name: 'inny.mkv', size: 5 }).diagnostics.map((d) => d.code)).toEqual(['KP009', 'KK008']);
  });
});
