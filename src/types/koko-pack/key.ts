/**
 * Klucz wypowiedzi (§6.2): `sha256` z kanonicznego JSON-u (RFC 8785 / JCS).
 * Obejmuje wszystko, co zmienia brzmienie, i nic, co zmienia tylko położenie.
 */
import type { Ipa, Ms } from '../common.js';
import type { NumberRulesVersion } from '../koko-ass/numbers.js';

/** Wersja schematu klucza. */
export const UTTERANCE_KEY_VERSION = 1 as const;

/** Miejsca po przecinku przy zaokrąglaniu `speed`. */
export const UTTERANCE_KEY_SPEED_DECIMALS = 4 as const;

/**
 * Segment kanoniczny — po normalizacji:
 * `~pisownia`/`sub=` → tekst; sąsiednie teksty scalone; białe znaki zwinięte;
 * pauzy zsumowane, bez pauz na brzegach; bez tekstu źródłowego i kluczy leksykonu.
 */
export type CanonicalSegment =
  | { t: 'text'; s: string; g?: true }
  | { t: 'ipa'; s: Ipa; g?: true }
  | { t: 'pause'; ms: Ms };

/** Obiekt haszowany do `key`. */
export interface UtteranceKeyInput {
  v: typeof UTTERANCE_KEY_VERSION;
  /** `synthesis.modelHash` albo `synthesis.model`. */
  model: string;
  /** `synthesis.g2p`. */
  g2p: string;
  /** Efektywny głos. */
  voice: string;
  /** Prędkość bazowa przed dopasowaniem, zaokrąglona do 4 miejsc. */
  speed: number;
  /** Wersja reguł liczb — tylko przy `Numbers = auto`, inaczej pole pominięte. */
  numbers?: NumberRulesVersion;
  segments: CanonicalSegment[];
}
