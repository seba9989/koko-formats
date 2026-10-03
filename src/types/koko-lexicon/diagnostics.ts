/** Diagnostyka pliku leksykonu serii (KL). IPA spoza słownika → KK101 (Koko-ASS). */
import type { DiagnosticDefinition, DiagnosticUnion } from '../common.js';
import type { LexiconForbiddenChar, LexiconWordRole } from './file.js';

export const KL_DIAGNOSTICS = {
  KL001: { level: 'warning', title: 'Niepoprawny plik leksykonu' },
  KL002: { level: 'warning', title: 'Nieobsługiwana wersja leksykonu' },
  KL003: { level: 'warning', title: 'Nieznane pole' },
  KL004: { level: 'warning', title: 'Niepoprawny wpis' },
  KL005: { level: 'warning', title: 'Słowo w kilku wpisach' },
  KL006: { level: 'info', title: 'Wpis niesprawdzony' },
} as const satisfies Record<string, DiagnosticDefinition>;

export type KlCode = keyof typeof KL_DIAGNOSTICS;

/** Co zostaje pominięte przy KL004. */
export type Kl004Target =
  | { kind: 'entry'; entryKey: string }
  | { kind: 'alias'; entryKey: string; alias: string }
  | { kind: 'form'; entryKey: string; form: string };

export type Kl004Reason =
  | { reason: 'pronunciation'; /** `ipa` + `respell` albo żadne. */ found: 'both' | 'none' }
  | { reason: 'type'; field: string }
  | { reason: 'forbiddenChar'; char: LexiconForbiddenChar }
  | { reason: 'empty' };

/**
 * Dane kodów. Komunikaty POWINNY podawać klucz wpisu;
 * KL001 — linię i kolumnę (w `Diagnostic.location`).
 */
export interface KlDiagnosticData {
  KL001: { reason: 'toml' | 'missingFormat' | 'missingVersion' | 'missingEntries' };
  KL002: { found: number; supported: number };
  KL003: { entryKey?: string; field: string };
  KL004: Kl004Target & Kl004Reason;
  KL005: {
    word: string;
    /** Wpis, który zatrzymuje słowo (pierwszy klucz wg kodów Unicode). */
    keptIn: string;
    droppedFrom: string;
    role: LexiconWordRole;
  };
  KL006: { entryKey: string };
}

export type KlDiagnostic = DiagnosticUnion<typeof KL_DIAGNOSTICS, KlDiagnosticData>;
export type KlDiagnosticOf<C extends KlCode> = Extract<KlDiagnostic, { code: C }>;

/** KL001 i KL002 powodują pominięcie całego pliku (działa jak brak leksykonu). */
export const KL_FILE_FATAL = ['KL001', 'KL002'] as const satisfies readonly KlCode[];
