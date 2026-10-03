/** Kontrola przy otwarciu i dopasowanie wypowiedzi (§6.1, §6.3). */
import type { Ms, Sha256 } from '../common.js';
import type { TimelineUtterance } from './timeline.js';

/** Stan wypowiedzi po porównaniu bieżących napisów z `timeline.json`. */
export type UtteranceState =
  /** Klucz jest, slot i prędkość bez zmian. */
  | { state: 'current'; key: Sha256; entry: TimelineUtterance }
  /** Klucz jest, slot inny, prędkość ta sama → przeniesienie bez syntezy (KP102). */
  | { state: 'moved'; key: Sha256; entry: TimelineUtterance; slot: { start: Ms; end: Ms } }
  /** Klucz jest, nowy slot wymaga innej prędkości → synteza (KP101). */
  | { state: 'respeed'; key: Sha256; entry: TimelineUtterance; speed: number }
  /** Klucza brak → synteza (KP101). */
  | { state: 'new'; key: Sha256 }
  /** Wpis bez odpowiednika w napisach → wyciszenie (KP103). */
  | { state: 'orphaned'; entry: TimelineUtterance };

export type UtteranceStateKind = UtteranceState['state'];

/** Podsumowanie dopasowania, np. do paska stanu Koko-Editor. */
export type MatchSummary = Record<UtteranceStateKind, number>;

/** Wynik dopasowania wideo (§3). */
export type PackVideoMatch =
  | { kind: 'manifest' } //             pasuje do manifest.video → OK
  | { kind: 'otherSource'; label: string } // inny wpis [Koko Sources] → KP009 info
  | { kind: 'none' } //                 nic → KP009 + KK008
  | { kind: 'unknown' }; //             brak danych do porównania

/** Kroki kontroli przy otwarciu w kolejności ze specyfikacji. */
export type OpenCheckStep =
  | 'container' //  1. mimetype, manifest, version
  | 'files' //      2. pliki z manifestu, kodeki
  | 'signatures' // 3. podpisy i rejestr
  | 'audioHash' //  4. hash audio
  | 'subtitles' //  5. hash napisów / timeline
  | 'synthesis'; // 6. konfiguracja syntezy
