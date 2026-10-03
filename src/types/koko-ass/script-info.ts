/** `[Script Info]` — standardowe pola ASS + klucz wersji Koko-ASS. */

/** Obsługiwana wersja formatu (`KokoAnime Version`). Wyższa → KK002. */
export const KOKO_ASS_VERSION = 1 as const;
export type KokoAssVersion = typeof KOKO_ASS_VERSION;

export interface ScriptInfo {
  scriptType: 'v4.00+';
  playResX?: number;
  playResY?: number;
  /**
   * `KokoAnime Version`. `null` = zwykły ASS (wszystkie klucze Koko mają
   * wartości domyślne).
   */
  kokoAnimeVersion: number | null;
  /** Pozostałe pola `[Script Info]` zachowane bez interpretacji. */
  other: Record<string, string>;
}
