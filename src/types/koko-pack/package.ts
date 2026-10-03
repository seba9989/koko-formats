/** Paczka po otwarciu — stan dla Koko-Editor / Koko-Player. */
import type { KkDiagnostic } from '../koko-ass/diagnostics.js';
import type { KokoAssParseResult } from '../koko-ass/document.js';
import type { PackZipEntry } from './container.js';
import type { KpDiagnostic } from './diagnostics.js';
import type { Manifest } from './manifest.js';
import type { MatchSummary, PackVideoMatch, UtteranceState } from './matching.js';
import type { SignatureVerification, SignaturesFile } from './signatures.js';
import type { Timeline } from './timeline.js';

export interface OpenedPack {
  manifest: Manifest;
  entries: PackZipEntry[];
  subtitles: KokoAssParseResult;
  /** `null` w profilu `distribution` lub gdy unieważniony (KP006, KP104). */
  timeline: Timeline | null;
  signatures: SignaturesFile | null;
  verifications: SignatureVerification[];
  /** Najsłabszy status spośród podpisów; `unsigned` = brak `signatures.json`. */
  trust: SignatureVerification['trust']['status'] | 'unsigned';
  video: PackVideoMatch;
  /** Wynik §6.3 (tylko przy otwarciu do edycji). */
  utterances?: UtteranceState[];
  summary?: MatchSummary;
  /** KP + KK z parsowania `subtitles.ass` (leksykon serii jest spłaszczony, więc KL nie występują). */
  diagnostics: (KpDiagnostic | KkDiagnostic)[];
}
