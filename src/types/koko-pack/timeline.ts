/** `timeline.json` (§5) — wynik dopasowania czasowego, plik pochodny. */
import type { Ms, Sha256 } from '../common.js';
import type { KkCode } from '../koko-ass/diagnostics.js';

/** Diagnostyki timingu zapisywane przy wypowiedzi. */
export type TimelineDiagnosticCode = Extract<KkCode, 'KK401' | 'KK402' | 'KK403'>;

export interface TimelineUtterance {
  /** Klucz danych wejściowych syntezy — **jedyna** podstawa dopasowania. */
  key: Sha256;
  /** Slot z napisów (start z `offset`). */
  slot: { start: Ms; end: Ms };
  /** Rzeczywiste położenie klipu (`t0`, długość po syntezie). */
  clip: { start: Ms; duration: Ms };
  /** Długość przy prędkości bazowej. */
  baseDuration: Ms;
  /** Prędkość faktycznie użyta. */
  speed: number;
  /** Opóźnienie względem slotu. */
  delay: Ms;
  diagnostics?: TimelineDiagnosticCode[];
  /** Numery linii przy zapisie — tylko informacyjnie. */
  lines?: number[];
  /** Tekst mówiony (IPA w `/…/`) — tylko informacyjnie. */
  text?: string;
}

export interface Timeline {
  version: 1;
  /** `id` ścieżki `lektor`. */
  audio: string;
  /** Hash napisów, z których powstała oś. */
  subtitlesSha256: Sha256;
  /** W kolejności czasu. */
  utterances: TimelineUtterance[];
}
