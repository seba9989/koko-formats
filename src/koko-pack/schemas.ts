/**
 * Schematy arktype dla plików JSON w paczce (Koko-Pack v1, §3–5, §8.1).
 *
 * Nieznane pola są przepuszczane bez zmian (§3: „MUSZĄ być ignorowane”).
 * Na końcu pliku kompilator sprawdza, że wynik każdego schematu pasuje do
 * typów ze specyfikacji — rozjazd schematu i typów to błąd kompilacji.
 */
import { type } from 'arktype';
import { PACK_PATHS } from '../types/index.js';
import type { AudioTrack, Manifest, Sha256, SignaturesFile, Timeline } from '../types/index.js';

// ─── Wspólne ────────────────────────────────────────────────────────────────

const sha256 = type(/^sha256:[0-9a-f]{64}$/).as<Sha256>();
const ms = type('number.integer');
const nonNegativeMs = type('number.integer >= 0');
const samples = type('number.integer >= 0');

// ─── manifest.json ──────────────────────────────────────────────────────────

/**
 * Ścieżka audio. `codec` to dowolny tekst — nieobsługiwany kodek daje KP016
 * (pominięcie ścieżki), a nie KP002 (odrzucenie paczki). Reguły Opus (§4)
 * sprawdza `narrow`.
 */
export const AUDIO_TRACK = type({
  id: 'string > 0',
  path: type(/^audio\/.+/).as<`audio/${string}`>(),
  role: "'lektor' | 'mix'",
  codec: 'string',
  sampleRate: 'number.integer > 0',
  channels: '1 | 2',
  bitrateMode: "'cbr' | 'vbr'",
  'spliceable?': 'boolean',
  encoderDelay: samples,
  padding: samples,
  offset: ms,
  duration: nonNegativeMs,
  sha256,
  'language?': 'string',
  'loudness?': 'number',
}).narrow((track, ctx) => {
  if (track.codec !== 'opus') return true;
  if (track.sampleRate !== 48000) return ctx.reject({ path: ['sampleRate'], expected: '48000 for Opus', actual: String(track.sampleRate) });
  if (track.spliceable === true) return ctx.reject({ path: ['spliceable'], expected: 'false for Opus', actual: 'true' });
  return true;
});

const MANIFEST_BASE = type({
  format: "'koko-pack'",
  version: 'number.integer > 0',
  created: 'string',
  'modified?': 'string',
  generator: { name: 'string', version: 'string' },
  'title?': 'string',
  subtitles: {
    path: type.unit(PACK_PATHS.subtitles),
    sha256,
    kokoVersion: 'number.integer | null',
  },
  audio: AUDIO_TRACK.array(),
  'synthesis?': {
    'engine?': 'string',
    'model?': 'string',
    'modelHash?': sha256,
    'g2p?': 'string',
    'parser?': 'string',
    'voice?': 'string',
  },
  'video?': {
    'name?': 'string',
    'duration?': nonNegativeMs,
    'fingerprint?': sha256,
    'btih?': 'string',
    'btmh?': type(/^1220[0-9a-fA-F]{64}$/).as<`1220${string}`>(),
    'file?': 'string',
    'size?': 'number.integer >= 0',
  },
  'extensions?': 'Record<string, unknown>',
});

const FULL_MANIFEST = MANIFEST_BASE.and({
  profile: "'full'",
  timeline: { path: type.unit(PACK_PATHS.timeline), sha256 },
});

const DISTRIBUTION_MANIFEST = MANIFEST_BASE.and({ profile: "'distribution'" });

/** Manifest z kodekiem jako tekstem — przed kontrolą KP011/KP016. */
export const MANIFEST = FULL_MANIFEST.or(DISTRIBUTION_MANIFEST);
export type ManifestShape = typeof MANIFEST.infer;

// ─── timeline.json ──────────────────────────────────────────────────────────

export const TIMELINE_UTTERANCE = type({
  key: sha256,
  slot: { start: ms, end: ms },
  clip: { start: ms, duration: nonNegativeMs },
  baseDuration: nonNegativeMs,
  speed: 'number > 0',
  delay: ms,
  'diagnostics?': "('KK401' | 'KK402' | 'KK403')[]",
  'lines?': 'number.integer[]',
  'text?': 'string',
});

export const TIMELINE = type({
  version: '1',
  audio: 'string',
  subtitlesSha256: sha256,
  utterances: TIMELINE_UTTERANCE.array(),
});

// ─── signatures.json ────────────────────────────────────────────────────────

const SIGNATURE = type({
  alg: "'ed25519'",
  keyId: 'string',
  'registry?': "'koko'",
  publicKey: 'string',
  created: 'string',
  signature: 'string',
});

export const SIGNATURES = type({
  version: '1',
  signatures: SIGNATURE.array(),
});

// ─── Zgodność schematów z typami specyfikacji (tylko kompilacja) ────────────

type Assert<T extends true> = T;
type Fits<Schema, Spec> = [Schema] extends [Spec] ? true : false;
type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Pola zależne od kodeka (`codec`, `sampleRate`, `spliceable`) są w schemacie
 * luźniejsze — kodek sprawdza KP016, reguły Opus `narrow` — więc porównujemy resztę.
 */
type CodecFields = 'codec' | 'sampleRate' | 'spliceable';
export type AudioTrackFits = Assert<Fits<Without<typeof AUDIO_TRACK.infer, CodecFields>, Without<AudioTrack, CodecFields>>>;
export type ManifestFits = Assert<Fits<Without<ManifestShape, 'audio'>, Without<Manifest, 'audio'>>>;
export type TimelineFits = Assert<Fits<typeof TIMELINE.infer, Timeline>>;
export type SignaturesFits = Assert<Fits<typeof SIGNATURES.infer, SignaturesFile>>;
