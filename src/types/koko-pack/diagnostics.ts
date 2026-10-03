/** Diagnostyka Koko-Pack (KP). */
import type { DiagnosticDefinition, DiagnosticUnion, Sha256 } from '../common.js';
import type { AudioCodec } from './audio.js';

export const KP_DIAGNOSTICS = {
  // KP0xx — kontener i manifest
  KP001: { level: 'error', title: 'Niepoprawny mimetype' },
  KP002: { level: 'error', title: 'Niepoprawny manifest.json' },
  KP003: { level: 'error', title: 'Nieobsługiwana wersja' },
  KP004: { level: 'error', title: 'Brak pliku z manifestu' },
  KP005: { level: 'warning', title: 'Napisy zmienione poza Koko-Editor' },
  KP006: { level: 'error', title: 'Hash audio niezgodny z manifestem' },
  KP007: { level: 'error', title: 'Niedozwolona ścieżka lub plik' },
  KP008: { level: 'warning', title: 'Audio skompresowane' },
  KP009: { level: 'warning', title: 'Wideo nie pasuje do paczki' },
  KP010: { level: 'warning', title: 'Zmieniona konfiguracja syntezy' },
  KP011: { level: 'error', title: 'Niepoprawne role audio' },
  KP012: { level: 'warning', title: 'Parametry audio niezgodne z plikiem' },
  KP013: { level: 'error', title: 'Niepoprawny podpis' },
  KP014: { level: 'info', title: 'Podpis bez rejestru' },
  KP015: { level: 'warning', title: 'Plik nie spełnia warunków spliceable' },
  KP016: { level: 'error', title: 'Nieobsługiwany kodek' },
  KP017: { level: 'error', title: 'Klucz unieważniony w rejestrze' },
  KP018: { level: 'error', title: 'Możliwe podszycie' },
  KP019: { level: 'info', title: 'Rejestr nieosiągalny' },
  // KP1xx — oś czasu
  KP101: { level: 'info', title: 'Wypowiedzi do syntezy' },
  KP102: { level: 'info', title: 'Wypowiedzi przesunięte' },
  KP103: { level: 'warning', title: 'Wpisy osierocone' },
  KP104: { level: 'error', title: 'Niepoprawna oś czasu' },
  KP105: { level: 'info', title: 'Paczka dystrybucyjna bez osi czasu' },
} as const satisfies Record<string, DiagnosticDefinition>;

export type KpCode = keyof typeof KP_DIAGNOSTICS;

export interface KpDiagnosticData {
  KP003: { found: number; supported: number };
  KP004: { path: string };
  KP005: { expected: Sha256; actual: Sha256 };
  KP006: { trackId: string; expected: Sha256; actual: Sha256 };
  KP007: { path: string; reason: 'absolute' | 'dotSegment' | 'backslash' | 'symlink' | 'duplicate' | 'unknownRootEntry' | 'tooLarge' };
  KP008: { path: string };
  /** `informational = true`, gdy pasuje inny wpis `[Koko Sources]`. */
  KP009: { informational: boolean; sourceLabel?: string };
  KP010: { fields: string[] };
  KP011: { lektor: number; mix: number };
  KP012: { trackId: string; fields: string[] };
  KP013: { keyId: string };
  KP014: { keyId: string };
  KP015: { trackId: string; reason: string };
  KP016: { trackId: string; codec: string; supported: readonly AudioCodec[] };
  KP017: { keyId: string };
  KP018: { keyId: string };
  KP019: { keyId: string };
  KP101: { count: number };
  KP102: { count: number };
  KP103: { count: number };
  KP104: { reason: 'clipOutOfRange' | 'overlap' | 'invalid' };
  KP105: { utterances: number };
}

export type KpDiagnostic = DiagnosticUnion<typeof KP_DIAGNOSTICS, KpDiagnosticData>;
export type KpDiagnosticOf<C extends KpCode> = Extract<KpDiagnostic, { code: C }>;

