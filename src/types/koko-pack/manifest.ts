/** `manifest.json` (§3). */
import type { IsoDateTime, Ms, Sha256, VideoFingerprint } from '../common.js';
import type { BtInfoHashV1, BtInfoHashV2 } from '../koko-ass/sources.js';
import type { AudioTrack } from './audio.js';
import type { PackProfile, SubtitlesPath, TimelinePath, VendorExtensionId } from './container.js';

export interface ManifestGenerator {
  name: string;
  version: string;
}

/**
 * `subtitles.ass` z wkopiowanym, spłaszczonym leksykonem serii
 * (Koko-Lexicon §3) i `SeriesLexicon = none`; hash i klucze liczone z tego pliku.
 */
export interface ManifestSubtitles {
  path: SubtitlesPath;
  sha256: Sha256;
  /** `KokoAnime Version` z pliku (`null` = zwykły ASS). */
  kokoVersion: number | null;
}

export interface ManifestTimeline {
  path: TimelinePath;
  sha256: Sha256;
}

/** Konfiguracja syntezy; zmiana → całe audio nieaktualne (KP010). */
export interface ManifestSynthesis {
  /** Np. `plkokoro 0.4.1`. */
  engine?: string;
  /** Np. `Kokoro-82M-PL`. */
  model?: string;
  modelHash?: Sha256;
  /** Np. `Phonemis 1.2.0`. */
  g2p?: string;
  /** Implementacja parsowania Koko-ASS (wpływa na segmenty). */
  parser?: string;
  /** Efektywny głos. */
  voice?: string;
}

/** Wideo, na którym generowano audio (wpis z `[Koko Sources]`). Samo wideo nigdy nie trafia do paczki. */
export interface ManifestVideo {
  name?: string;
  duration?: Ms;
  fingerprint?: VideoFingerprint;
  btih?: BtInfoHashV1;
  btmh?: BtInfoHashV2;
  file?: string;
  size?: number;
}

interface ManifestBase {
  format: 'koko-pack';
  /** Wyższa niż obsługiwana → KP003. */
  version: number;
  created: IsoDateTime;
  modified?: IsoDateTime;
  generator: ManifestGenerator;
  title?: string;
  subtitles: ManifestSubtitles;
  audio: AudioTrack[];
  synthesis?: ManifestSynthesis;
  video?: ManifestVideo;
  extensions?: Partial<Record<VendorExtensionId, unknown>>;
}

/** Plik roboczy Koko-Editor — `timeline` wymagany. */
export interface FullManifest extends ManifestBase {
  profile: 'full';
  timeline: ManifestTimeline;
}

/** Paczka dla widzów — bez `timeline.json` i `cache/`. */
export interface DistributionManifest extends ManifestBase {
  profile: 'distribution';
  timeline?: never;
}

export type Manifest = FullManifest | DistributionManifest;

/** Pomocnicze: profil → typ manifestu. */
export type ManifestOf<P extends PackProfile> = Extract<Manifest, { profile: P }>;
