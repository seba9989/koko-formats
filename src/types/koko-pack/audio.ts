/** Ścieżki audio (§4) i podmiana ramek MP3 (§4.1). */
import type { LanguageTag, Ms, Samples, Sha256 } from '../common.js';
import type { AudioPath } from './container.js';

/** `lektor` — dokładnie 1; `mix` — 0 lub 1 (inaczej KP011). */
export type AudioRole = 'lektor' | 'mix';
export type AudioCodec = 'mp3' | 'opus';
export type BitrateMode = 'cbr' | 'vbr';

interface AudioTrackBase {
  /** Unikalny, np. `lektor`; używany w `timeline.json`. */
  id: string;
  path: AudioPath;
  role: AudioRole;
  /** Lektor POWINIEN być mono. */
  channels: 1 | 2;
  /** Cisza enkodera na początku (Opus: `pre-skip`) — czytelnik MUSI jej użyć. */
  encoderDelay: Samples;
  /** Dopełnienie na końcu. */
  padding: Samples;
  /** Czas napisów pierwszej próbki treści; zwykle `0`. */
  offset: Ms;
  /** Długość treści bez delay/padding. */
  duration: Ms;
  sha256: Sha256;
  language?: LanguageTag;
  /** LUFS — do normalizacji miksu. */
  loudness?: number;
}

export interface Mp3AudioTrack extends AudioTrackBase {
  codec: 'mp3';
  /** Np. `24000` (natywne Kokoro). */
  sampleRate: number;
  /** Zalecane `cbr`. */
  bitrateMode: BitrateMode;
  /** `true` = wolno podmieniać ramki (§4.1); domyślnie `false`. */
  spliceable?: boolean;
}

export interface OpusAudioTrack extends AudioTrackBase {
  codec: 'opus';
  sampleRate: 48000;
  bitrateMode: BitrateMode;
  /** Opus nigdy nie jest spliceable. */
  spliceable?: false;
}

/** Wpis tablicy `manifest.audio`. */
export type AudioTrack = Mp3AudioTrack | OpusAudioTrack;

// ─── §4.1 Podmiana ramek ────────────────────────────────────────────────────

export type MpegVersion = 'mpeg1' | 'mpeg2' | 'mpeg2.5';

/** Próbki na ramkę (`N`). */
export const MPEG_FRAME_SAMPLES = {
  mpeg1: 1152,
  mpeg2: 576,
  'mpeg2.5': 576,
} as const satisfies Record<MpegVersion, number>;

/** Margines ramek po obu stronach podmienianego zakresu (MUSI leżeć w ciszy). */
export const SPLICE_MARGIN_FRAMES = 2 as const;

/** Parametry strumienia MP3 odczytane z pliku, potrzebne do podmiany. */
export interface Mp3StreamLayout {
  mpegVersion: MpegVersion;
  sampleRate: number;
  /** kbit/s. */
  bitrate: number;
  /** Rozmiar ramki `S` w bajtach (stały). */
  frameSize: number;
  /** Próbki na ramkę `N`. */
  frameSamples: number;
  /** Offset pierwszej ramki audio (za ID3v2 i Xing/Info). */
  firstFrameOffset: number;
  frameCount: number;
  /** Ramki z CRC. */
  hasCrc: boolean;
  /** `main_data_begin = 0` we wszystkich ramkach (LAME `--nores`). */
  noBitReservoir: boolean;
  /** Obecny nagłówek LAME/Xing (źródło `encoderDelay`/`padding`). */
  hasLameHeader: boolean;
}

/** Plan podmiany dla jednego klipu `[a, b)`. */
export interface SplicePlan {
  /** Zakres w ms napisów. */
  range: { start: Ms; end: Ms };
  /** `fa` — pierwsza podmieniana ramka. */
  firstFrame: number;
  /** `fb` — ramka za ostatnią podmienianą. */
  endFrame: number;
  /** Rozszerzono o sąsiedni klip, bo margines nie leżał w ciszy. */
  extendedTo?: { start: Ms; end: Ms };
}
