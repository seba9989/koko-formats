/** `[Koko Sources]` — wydania wideo (BitTorrent) zsynchronizowane z napisami. */
import type { VideoFingerprint } from '../common.js';

/** Info-hash v1: 40 hex lub 32 base32. */
export type BtInfoHashV1 = string;
/** Info-hash v2 (multihash): `1220` + 64 hex. */
export type BtInfoHashV2 = `1220${string}`;

/** Wymagany co najmniej jeden hash (torrent hybrydowy: oba). */
type SourceHashes =
  | { btih: BtInfoHashV1; btmh?: BtInfoHashV2 }
  | { btih?: BtInfoHashV1; btmh: BtInfoHashV2 };

export type KokoSource = SourceHashes & {
  /** Klucz wpisu (etykieta), np. `SubsPlease 1080p`. */
  label: string;
  /** Ścieżka pliku w torrencie (separator `/`). */
  file: string;
  /** Rozmiar w bajtach. */
  size: number;
  /** Nazwa torrenta (`dn` w magnecie). */
  name?: string;
  fingerprint?: VideoFingerprint;
  line?: number;
};

/** Pola wartości wpisu `[Koko Sources]`; inne → KK001. */
export const KOKO_SOURCE_FIELDS = ['btih', 'btmh', 'file', 'size', 'name', 'fingerprint'] as const;
export type KokoSourceField = (typeof KOKO_SOURCE_FIELDS)[number];

/** Wartość wpisu po tokenizacji `k=v k="v v"` (klucze małymi literami). */
export type SourcePairs = ReadonlyMap<string, string>;

/** Lista w kolejności z pliku; pierwszy wpis = wydanie referencyjne (na nim robiono timing). */
export type KokoSources = KokoSource[];

/** Czym dopasowano otwarte wideo (od najmocniejszego). */
export type VideoMatchMethod = 'fingerprint' | 'sizeAndName' | 'size';

export type SourceMatch =
  | { matched: true; source: KokoSource; index: number; method: VideoMatchMethod }
  | { matched: false };
