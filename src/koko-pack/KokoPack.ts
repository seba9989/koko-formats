/**
 * KokoPack — paczka `.kokopack` (Koko-Pack v1): otwieranie z kontrolą
 * spójności, dostęp do napisów, audio i osi czasu, edycja i zapis.
 *
 *   const result = await KokoPack.open(bytes, { mode: 'edit' });
 *   if (!result.ok) return show(result.diagnostics);
 *   const pack = result.pack;
 *   pack.subtitles.events[0].text = '…';
 *   await writeFile(path, await pack.save());
 */
import { type } from 'arktype';
import { KOKO_PACK_MIME, KOKO_PACK_VERSION, PACK_PATHS } from '../types/index.js';
import type {
  AudioTrack, Manifest, ManifestGenerator, ManifestSynthesis, ManifestVideo, PackProfile,
  PackVideoMatch, SignaturesFile, Timeline, VideoFingerprint,
} from '../types/index.js';
import { KokoAss } from '../koko-ass/KokoAss.js';
import type { SeriesLexicon } from '../koko-lexicon/index.js';
import { kk008, kp } from './diagnostics.js';
import type { PackDiagnostic } from './diagnostics.js';
import { sha256 } from './hash.js';
import { MANIFEST, SIGNATURES, TIMELINE } from './schemas.js';
import type { ManifestShape } from './schemas.js';
import { fromUtf8, hasMimetypeHeader, parseJson, readZip, utf8, writeZip } from './zip.js';
import type { ReadZip, ZipFile } from './zip.js';

// ─── Typy publiczne ─────────────────────────────────────────────────────────

export type OpenMode = 'play' | 'edit';

export type OpenResult =
  | { ok: true; pack: KokoPack; diagnostics: PackDiagnostic[] }
  | { ok: false; diagnostics: PackDiagnostic[] };

/** Ścieżka do dodania — `role` i `sha256` uzupełnia paczka. */
export type NewAudioTrack = AudioTrack extends infer T ? (T extends AudioTrack ? Omit<T, 'role' | 'sha256'> : never) : never;

export interface CreatePackInit {
  generator: ManifestGenerator;
  subtitles: KokoAss;
  /** Spłaszczany do `[Koko Lexicon]` (`SeriesLexicon = none`). */
  seriesLexicon?: SeriesLexicon;
  lektor: { track: NewAudioTrack; data: Uint8Array };
  mix?: { track: NewAudioTrack; data: Uint8Array };
  timeline?: Timeline;
  /** Domyślnie `full`, gdy jest oś czasu, inaczej `distribution`. */
  profile?: PackProfile;
  title?: string;
  synthesis?: ManifestSynthesis;
  video?: ManifestVideo;
}

/** Otwarte wideo do porównania z paczką (§3). */
export interface OpenedVideo {
  /** Nazwa pliku (bez katalogów). */
  name: string;
  size: number;
  fingerprint?: VideoFingerprint;
}

const SUPPORTED_CODECS = ['mp3', 'opus'] as const;
const AUDIO_MIME = { mp3: 'audio/mpeg', opus: 'audio/ogg; codecs=opus' } as const;

// ─── Klasa ──────────────────────────────────────────────────────────────────

export class KokoPack {
  #manifest: Manifest;
  #subtitles: KokoAss;
  #timeline: Timeline | null;
  #signatures: SignaturesFile | null;
  /** Audio, `cache/` i rozszerzenia `x-…` — ścieżka → bajty. */
  readonly #files: Map<string, Uint8Array>;
  readonly #diagnostics: PackDiagnostic[];

  private constructor(init: {
    manifest: Manifest;
    subtitles: KokoAss;
    timeline: Timeline | null;
    signatures: SignaturesFile | null;
    files: Map<string, Uint8Array>;
    diagnostics: PackDiagnostic[];
  }) {
    this.#manifest = init.manifest;
    this.#subtitles = init.subtitles;
    this.#timeline = init.timeline;
    this.#signatures = init.signatures;
    this.#files = init.files;
    this.#diagnostics = init.diagnostics;
  }

  // ─── Otwieranie (§6.1) ────────────────────────────────────────────────────

  /** Nie rzuca z powodu danych: odrzucenie to `{ ok: false, diagnostics }`. */
  static async open(bytes: Uint8Array, { mode = 'play' }: { mode?: OpenMode } = {}): Promise<OpenResult> {
    const diagnostics: PackDiagnostic[] = [];
    const reject = (): OpenResult => ({ ok: false, diagnostics });

    // 1. Kontener i manifest
    if (!hasMimetypeHeader(bytes)) {
      diagnostics.push(kp('KP001', 'Brak poprawnego wpisu mimetype na początku archiwum'));
      return reject();
    }
    const zip = readZip(bytes, diagnostics);
    if (!zip) return reject();

    const shape = MANIFEST(parseJson(zip.files.get(PACK_PATHS.manifest)));
    if (shape instanceof type.errors) {
      diagnostics.push(kp('KP002', `manifest.json: ${shape.summary}`));
      return reject();
    }
    if (shape.version > KOKO_PACK_VERSION) {
      diagnostics.push(kp('KP003', `Wersja ${shape.version}`, { found: shape.version, supported: KOKO_PACK_VERSION }));
      return reject();
    }

    // 2. Pliki z manifestu i kodeki
    const manifest = checkTracks(shape, zip, diagnostics);
    if (!manifest) return reject();
    const subtitleBytes = zip.files.get(PACK_PATHS.subtitles);
    if (!subtitleBytes) {
      diagnostics.push(kp('KP004', 'Brak subtitles.ass', { path: PACK_PATHS.subtitles }));
      return reject();
    }

    // 3. Podpisy — tylko odczyt; weryfikacja wymaga rejestru twórców (§8.2)
    const signatures = readSignatures(zip, diagnostics);

    // 4–5. Hashe audio i napisów, oś czasu
    let timeline = readTimeline(manifest, zip, diagnostics);
    const subtitlesHash = await sha256(subtitleBytes);

    for (const track of manifest.audio) {
      const actual = await sha256(zip.files.get(track.path)!);
      if (actual !== track.sha256) {
        diagnostics.push(kp('KP006', `${track.id}: hash audio`, { trackId: track.id, expected: track.sha256, actual }));
        if (timeline?.audio === track.id) timeline = null;
      }
    }

    const expected = manifest.subtitles.sha256;
    if (subtitlesHash !== expected || (timeline && timeline.subtitlesSha256 !== subtitlesHash)) {
      diagnostics.push(kp('KP005', 'Napisy zmienione poza Koko-Editor', { expected, actual: subtitlesHash }));
    }

    if (timeline && !timelineFits(timeline, manifest, diagnostics)) timeline = null;

    // Napisy (diagnostyki KK) i profil dystrybucyjny
    const subtitles = KokoAss.parse(fromUtf8(subtitleBytes));
    diagnostics.push(...subtitles.diagnostics);

    if (mode === 'edit' && manifest.profile === 'distribution') {
      const count = subtitles.dialogues().length;
      diagnostics.push(kp('KP105', 'Brak osi czasu — wszystkie wypowiedzi „nowe”', { utterances: count }));
    }

    const files = new Map([...zip.files].filter(([path]) => isPayload(path)));
    const pack = new KokoPack({ manifest, subtitles, timeline, signatures, files, diagnostics: [...diagnostics] });
    return { ok: true, pack, diagnostics };
  }

  // ─── Tworzenie ────────────────────────────────────────────────────────────

  static async create(init: CreatePackInit): Promise<KokoPack> {
    const now = isoNow();
    const lektor = { ...init.lektor.track, role: 'lektor', sha256: await sha256(init.lektor.data) } as AudioTrack;
    const mix = init.mix && ({ ...init.mix.track, role: 'mix', sha256: await sha256(init.mix.data) } as AudioTrack);

    const files = new Map([[lektor.path, init.lektor.data]]);
    if (mix && init.mix) files.set(mix.path, init.mix.data);

    const manifest: Manifest = {
      format: 'koko-pack',
      version: KOKO_PACK_VERSION,
      profile: 'distribution',
      created: now,
      generator: init.generator,
      subtitles: { path: PACK_PATHS.subtitles, sha256: 'sha256:', kokoVersion: null },
      audio: mix ? [lektor, mix] : [lektor],
      ...(init.title !== undefined && { title: init.title }),
      ...(init.synthesis !== undefined && { synthesis: init.synthesis }),
      ...(init.video !== undefined && { video: init.video }),
    };

    const pack = new KokoPack({
      manifest,
      subtitles: init.subtitles,
      timeline: init.timeline ?? null,
      signatures: null,
      files,
      diagnostics: [],
    });

    pack.setSubtitles(init.subtitles, init.seriesLexicon);
    pack.setProfile(init.profile ?? (init.timeline ? 'full' : 'distribution'));
    pack.#manifest.subtitles.sha256 = await sha256(utf8(pack.#subtitles.toString()));
    pack.#manifest.subtitles.kokoVersion = pack.#subtitles.scriptInfo.kokoAnimeVersion;
    return pack;
  }

  // ─── Odczyt ───────────────────────────────────────────────────────────────

  /** Hashe w manifeście są aktualne po `save()` (i po otwarciu). */
  get manifest(): Readonly<Manifest> { return this.#manifest; }
  get profile(): PackProfile { return this.#manifest.profile; }

  /** Napisy — edytowalne wprost (`pack.subtitles.events…`, `pack.subtitles.set(…)`). */
  get subtitles(): KokoAss { return this.#subtitles; }

  /** `null` w profilu `distribution` albo gdy oś czasu unieważniono (KP006, KP104). */
  get timeline(): Timeline | null { return this.#timeline; }
  get signatures(): SignaturesFile | null { return this.#signatures; }

  /** Diagnostyki z otwarcia (KP + KK z napisów). */
  get diagnostics(): readonly PackDiagnostic[] { return this.#diagnostics; }

  get tracks(): readonly AudioTrack[] { return this.#manifest.audio; }

  /** Ścieżka `lektor` — zawsze dokładnie jedna (KP011). */
  get lektor(): AudioTrack {
    return this.#manifest.audio.find((t) => t.role === 'lektor')!;
  }

  track(id: string): AudioTrack | undefined {
    return this.#manifest.audio.find((t) => t.id === id);
  }

  audio(id: string): Uint8Array | undefined {
    const track = this.track(id);
    return track && this.#files.get(track.path);
  }

  /** Audio jako `Blob` z typem MIME — do `URL.createObjectURL` w odtwarzaczu. */
  audioBlob(id: string): Blob | undefined {
    const track = this.track(id);
    const data = this.audio(id);
    return track && data && new Blob([data as Uint8Array<ArrayBuffer>], { type: AUDIO_MIME[track.codec] });
  }

  // ─── Kontrole zależne od otoczenia (§3, §6.1 pkt 6) ───────────────────────

  /** Wideo: najpierw `manifest.video`, potem `[Koko Sources]` (odcisk → rozmiar + nazwa → rozmiar). */
  matchVideo(video: OpenedVideo): { match: PackVideoMatch; diagnostics: PackDiagnostic[] } {
    if (this.#manifest.video && matchLevel(this.#manifest.video, video) > 0) {
      return { match: { kind: 'manifest' }, diagnostics: [] };
    }

    const source = bestMatch(this.#subtitles.sources, video);
    if (source) {
      const info = kp('KP009', `Inne wydanie: ${source.label}`, { informational: true, sourceLabel: source.label });
      return { match: { kind: 'otherSource', label: source.label }, diagnostics: [info] };
    }

    const warning = kp('KP009', 'Wideo nie pasuje do paczki', { informational: false });
    return { match: { kind: 'none' }, diagnostics: [warning, kk008()] };
  }

  /** KP010, gdy bieżąca konfiguracja syntezy różni się od tej w paczce. */
  checkSynthesis(current: ManifestSynthesis): PackDiagnostic[] {
    const saved = this.#manifest.synthesis;
    if (!saved) return [];

    const fields = (Object.keys(current) as (keyof ManifestSynthesis)[]).filter(
      (field) => saved[field] !== undefined && saved[field] !== current[field],
    );
    return fields.length > 0 ? [kp('KP010', `Zmienione: ${fields.join(', ')}`, { fields })] : [];
  }

  // ─── Edycja ───────────────────────────────────────────────────────────────

  /**
   * Podmienia napisy na kopię gotową do paczki: leksykon serii spłaszczony
   * do `[Koko Lexicon]` i zawsze `SeriesLexicon = none`.
   */
  setSubtitles(subtitles: KokoAss, seriesLexicon?: SeriesLexicon): void {
    const copy = KokoAss.parse(subtitles.toString());
    if (seriesLexicon?.usable) seriesLexicon.embedInto(copy);
    else copy.set('Koko Rules', 'SeriesLexicon', 'none');
    this.#subtitles = copy;
  }

  /** Nowe bajty istniejącej ścieżki; parametry ścieżki opcjonalnie nadpisane. */
  setAudio(id: string, data: Uint8Array, changes: Partial<NewAudioTrack> = {}): void {
    const index = this.#manifest.audio.findIndex((t) => t.id === id);
    if (index < 0) throw new Error(`Brak ścieżki „${id}”`);

    const track = { ...this.#manifest.audio[index]!, ...changes } as AudioTrack;
    this.#manifest.audio[index] = track;
    this.#files.set(track.path, data);
  }

  /** Oś czasu — wynik dopasowania (§6.3); `subtitlesSha256` ustawia wywołujący. */
  setTimeline(timeline: Timeline | null): void {
    this.#timeline = timeline;
  }

  /** `distribution` pomija przy zapisie `timeline.json` i `cache/`; `full` wymaga osi czasu. */
  setProfile(profile: PackProfile): void {
    if (profile === 'full' && !this.#timeline) throw new Error('Profil full wymaga osi czasu');
    this.#manifest = { ...this.#manifest, profile } as Manifest;
  }

  update(changes: { title?: string; synthesis?: ManifestSynthesis; video?: ManifestVideo }): void {
    this.#manifest = { ...this.#manifest, ...changes };
  }

  // ─── Zapis ────────────────────────────────────────────────────────────────

  /**
   * Przelicza hashe, `modified` i `kokoVersion`, zapisuje ZIP w kolejności
   * ze specyfikacji. Usuwa podpisy — zmieniony manifest je unieważnia (§8.1).
   */
  async save(): Promise<Uint8Array> {
    const subtitles = utf8(this.#subtitles.toString());
    const full = this.profile === 'full';
    const timeline = full && this.#timeline ? utf8(JSON.stringify(this.#timeline, null, 2)) : null;
    if (full && !timeline) throw new Error('Profil full wymaga osi czasu');

    const audio = await Promise.all(
      this.#manifest.audio.map(async (track) => ({ ...track, sha256: await sha256(this.#files.get(track.path)!) })),
    );

    const { profile: _profile, timeline: _timeline, ...base } = this.#manifest;
    const common = {
      ...base,
      modified: isoNow(),
      subtitles: { path: PACK_PATHS.subtitles, sha256: await sha256(subtitles), kokoVersion: this.#subtitles.scriptInfo.kokoAnimeVersion },
      audio,
    };
    this.#manifest = timeline
      ? { ...common, profile: 'full', timeline: { path: PACK_PATHS.timeline, sha256: await sha256(timeline) } }
      : { ...common, profile: 'distribution' };
    this.#signatures = null;

    const files: ZipFile[] = [
      { path: PACK_PATHS.mimetype, data: utf8(KOKO_PACK_MIME), method: 'stored' },
      { path: PACK_PATHS.manifest, data: utf8(JSON.stringify(this.#manifest, null, 2)), method: 'deflate' },
      { path: PACK_PATHS.subtitles, data: subtitles, method: 'deflate' },
      ...audio.map((t) => ({ path: t.path, data: this.#files.get(t.path)!, method: 'stored' as const })),
      ...(timeline ? [{ path: PACK_PATHS.timeline, data: timeline, method: 'deflate' as const }] : []),
      ...[...this.#files]
        .filter(([path]) => (full && path.startsWith(PACK_PATHS.cacheDir)) || path.startsWith('x-'))
        .map(([path, data]) => ({ path, data, method: 'deflate' as const })),
    ];
    return writeZip(files);
  }
}

// ─── Kontrole przy otwarciu ─────────────────────────────────────────────────

/**
 * KP011 (role), KP016 (kodeki), KP004 (pliki), KP008 (kompresja).
 * Zwraca manifest z obsługiwanymi ścieżkami albo `null` (odrzucenie).
 */
function checkTracks(shape: ManifestShape, zip: ReadZip, diagnostics: PackDiagnostic[]): Manifest | null {
  const count = (role: AudioTrack['role']) => shape.audio.filter((t) => t.role === role).length;
  const lektor = count('lektor');
  const mix = count('mix');
  if (lektor !== 1 || mix > 1) {
    diagnostics.push(kp('KP011', 'Niepoprawne role audio', { lektor, mix }));
    return null;
  }

  const usable: AudioTrack[] = [];
  for (const track of shape.audio) {
    const isLektor = track.role === 'lektor';

    if (!isSupported(track)) {
      diagnostics.push(kp('KP016', `${track.id}: ${track.codec}`, { trackId: track.id, codec: track.codec, supported: SUPPORTED_CODECS }));
      if (isLektor) return null;
      continue;
    }
    if (!zip.files.has(track.path)) {
      diagnostics.push(kp('KP004', `Brak ${track.path}`, { path: track.path }));
      if (isLektor) return null;
      continue;
    }
    if (zip.entries.find((e) => e.path === track.path)?.method !== 'stored') {
      diagnostics.push(kp('KP008', `${track.path} skompresowane`, { path: track.path }));
    }
    usable.push(track);
  }

  // Pominięte ścieżki znikają z manifestu; reszta pól zgodna z typem (ManifestFits w schemas.ts).
  return { ...shape, audio: usable } as Manifest;
}

/** Kodek obsługiwany → ścieżka spełnia `AudioTrack` (reguły Opus sprawdził schemat). */
function isSupported(track: ManifestShape['audio'][number]): track is ManifestShape['audio'][number] & AudioTrack {
  return (SUPPORTED_CODECS as readonly string[]).includes(track.codec);
}

function readTimeline(manifest: Manifest, zip: ReadZip, diagnostics: PackDiagnostic[]): Timeline | null {
  if (manifest.profile !== 'full') return null;

  const bytes = zip.files.get(PACK_PATHS.timeline);
  if (!bytes) {
    diagnostics.push(kp('KP004', 'Brak timeline.json', { path: PACK_PATHS.timeline }));
    return null;
  }

  const timeline = TIMELINE(parseJson(bytes));
  if (timeline instanceof type.errors) {
    diagnostics.push(kp('KP104', `timeline.json: ${timeline.summary}`, { reason: 'invalid' }));
    return null;
  }
  return timeline;
}

/** KP104: klip poza długością audio lub nakładające się klipy. */
function timelineFits(timeline: Timeline, manifest: Manifest, diagnostics: PackDiagnostic[]): boolean {
  const track = manifest.audio.find((t) => t.id === timeline.audio);
  if (!track) {
    diagnostics.push(kp('KP104', `Brak ścieżki ${timeline.audio}`, { reason: 'invalid' }));
    return false;
  }

  const audioEnd = track.offset + track.duration;
  const clips = timeline.utterances.map((u) => u.clip).sort((a, b) => a.start - b.start);
  let previousEnd = -Infinity;

  for (const clip of clips) {
    const end = clip.start + clip.duration;
    if (clip.start < track.offset || end > audioEnd) {
      diagnostics.push(kp('KP104', 'Klip poza długością audio', { reason: 'clipOutOfRange' }));
      return false;
    }
    if (clip.start < previousEnd) {
      diagnostics.push(kp('KP104', 'Nakładające się klipy', { reason: 'overlap' }));
      return false;
    }
    previousEnd = end;
  }
  return true;
}

function readSignatures(zip: ReadZip, diagnostics: PackDiagnostic[]): SignaturesFile | null {
  const bytes = zip.files.get(PACK_PATHS.signatures);
  if (!bytes) return null;

  const signatures = SIGNATURES(parseJson(bytes));
  if (!(signatures instanceof type.errors)) return signatures;

  diagnostics.push(kp('KP013', `signatures.json: ${signatures.summary}`, { keyId: '' }));
  return null;
}

// ─── Pomocnicze ─────────────────────────────────────────────────────────────

/** Pliki trzymane w pamięci jako bajty (reszta ma własne pola). */
const isPayload = (path: string) =>
  path.startsWith(PACK_PATHS.audioDir) || path.startsWith(PACK_PATHS.cacheDir) || path.startsWith('x-');

const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

type VideoCandidate = { fingerprint?: string; size?: number; file?: string; name?: string };

/** Siła dopasowania: 3 = odcisk, 2 = rozmiar + nazwa pliku, 1 = sam rozmiar, 0 = brak. */
function matchLevel(candidate: VideoCandidate, video: OpenedVideo): number {
  if (candidate.fingerprint && video.fingerprint) return candidate.fingerprint === video.fingerprint ? 3 : 0;
  if (candidate.size !== video.size) return 0;

  const names = [candidate.file, candidate.name].filter((n): n is string => !!n).map(basename);
  return names.includes(video.name) ? 2 : 1;
}

function bestMatch<T extends VideoCandidate>(candidates: readonly T[], video: OpenedVideo): T | undefined {
  let best: T | undefined;
  let bestLevel = 0;
  for (const candidate of candidates) {
    const level = matchLevel(candidate, video);
    if (level > bestLevel) [best, bestLevel] = [candidate, level];
  }
  return best;
}
