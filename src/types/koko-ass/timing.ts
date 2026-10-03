/**
 * Dopasowanie czasowe i miks (Koko-ASS §4.6) — wymaga długości audio z syntezy.
 */
import type { Ms } from '../common.js';

/** Wynik syntezy jednej wypowiedzi przy danej prędkości. */
export interface SynthesisMeasurement {
  speed: number;
  duration: Ms;
}

/** Umieszczenie wypowiedzi na osi czasu. */
export interface TimedUtterance {
  utteranceIndex: number;
  /** `max(start + offset, prev_end + MinGap)`. */
  t0: Ms;
  /** `t0 − (start + offset)`. */
  delay: Ms;
  /** `next.start` (BorrowGap) lub `end`. */
  slotEnd: Ms;
  /** `slotEnd − t0`. */
  slot: Ms;
  /** Prędkość bazowa `s0`. */
  baseSpeed: number;
  /** Długość przy `s0`. */
  baseDuration: Ms;
  /** Prędkość faktycznie użyta. */
  speed: number;
  /** Długość klipu po syntezie z `speed`. */
  duration: Ms;
  /** Klip wychodzi poza slot (KK402). */
  overflow: boolean;
}

/** Próg informacji KK401. */
export const SPEEDUP_INFO_THRESHOLD = 1.15 as const;

/** Przedział ściszenia oryginału (po scaleniu bliższych niż attack + release). */
export interface DuckInterval {
  start: Ms;
  end: Ms;
}

/** Ścieżki eksportowane osobno. */
export type MixOutput = 'lektor' | 'mix';
