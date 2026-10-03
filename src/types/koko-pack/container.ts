/** Kontener ZIP Koko-Pack: stałe, ścieżki, profile (§1–2). */

export const KOKO_PACK_EXTENSION = '.kokopack' as const;
export const KOKO_PACK_MIME = 'application/vnd.koko-anime.pack+zip' as const;
/** Obsługiwana wersja (`manifest.version`); wyższa → KP003. */
export const KOKO_PACK_VERSION = 1 as const;

/** Wykrywanie bez rozpakowania (jak EPUB/ODF). */
export const KOKO_PACK_MAGIC = {
  mimetypeNameOffset: 30,
  mimetypeValueOffset: 38,
  mimetypeLength: 35,
} as const;

export type PackProfile = 'full' | 'distribution';

/** Dozwolone metody kompresji (inne zabronione). */
export type ZipMethod = 'stored' | 'deflate';

/** Prefiks rozszerzeń dostawcy, np. `x-acme`. */
export type VendorExtensionId = `x-${string}`;

/** Stałe ścieżki w katalogu głównym. */
export const PACK_PATHS = {
  mimetype: 'mimetype',
  manifest: 'manifest.json',
  subtitles: 'subtitles.ass',
  timeline: 'timeline.json',
  signatures: 'signatures.json',
  audioDir: 'audio/',
  cacheDir: 'cache/',
} as const;

export type SubtitlesPath = typeof PACK_PATHS.subtitles;
export type TimelinePath = typeof PACK_PATHS.timeline;
export type AudioPath = `audio/${string}`;
export type CachePath = `cache/${string}`;
export type VendorPath = `${VendorExtensionId}/${string}`;

/** Każda dozwolona ścieżka w archiwum; inne w katalogu głównym → KP007. */
export type PackEntryPath =
  | typeof PACK_PATHS.mimetype
  | typeof PACK_PATHS.manifest
  | SubtitlesPath
  | TimelinePath
  | typeof PACK_PATHS.signatures
  | AudioPath
  | CachePath
  | VendorPath;

/** Wpis centralnego katalogu ZIP widziany przez czytnik. */
export interface PackZipEntry {
  path: string;
  method: ZipMethod;
  compressedSize: number;
  uncompressedSize: number;
  /** Offset nagłówka lokalnego — do odczytu zakresu bajtów audio STORED. */
  localHeaderOffset: number;
  /** Offset początku danych (za nagłówkiem lokalnym). */
  dataOffset?: number;
}

/** Limity bezpieczeństwa (§8). */
export const PACK_LIMITS = {
  /** Maks. rozmiar JSON / napisów po rozpakowaniu. */
  maxTextBytes: 64 * 1024 * 1024,
  /** Maks. współczynnik kompresji. */
  maxCompressionRatio: 100,
} as const;
