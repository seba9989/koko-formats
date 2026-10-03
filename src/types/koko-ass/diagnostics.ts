/** Diagnostyka Koko-ASS (KK). Błędy pliku leksykonu serii: KL (moduł `koko-lexicon`). */
import type { DiagnosticDefinition, DiagnosticUnion, Ms } from '../common.js';
import type { NumberExpansion } from './numbers.js';

export const KK_DIAGNOSTICS = {
  // KK0xx — składnia i nagłówek
  KK001: { level: 'warning', title: 'Nieznany klucz' },
  KK002: { level: 'error', title: 'Nieobsługiwana wersja formatu' },
  KK003: { level: 'warning', title: 'Błędna składnia adnotacji' },
  KK004: { level: 'warning', title: 'Niezamknięty zakres' },
  KK005: { level: 'warning', title: 'say= razem z zakresami' },
  KK006: { level: 'warning', title: 'Niepoprawna wartość' },
  KK007: { level: 'warning', title: 'Niepoprawny wpis źródła' },
  KK008: { level: 'info', title: 'Wideo nie pasuje do żadnego źródła' },
  KK009: { level: 'warning', title: 'Brak pliku leksykonu serii' },
  // KK1xx — wymowa
  KK101: { level: 'error', title: 'IPA spoza słownika modelu' },
  KK102: { level: 'info', title: 'Możliwe imię spoza leksykonu' },
  // KK2xx — tekst
  KK201: { level: 'info', title: 'Pusta linia po czyszczeniu' },
  KK202: { level: 'warning', title: 'Cyfry w tekście mówionym' },
  KK203: { level: 'info', title: 'Liczba rozwinięta automatycznie' },
  KK204: { level: 'warning', title: 'Rozwinięcie bez kontekstu' },
  // KK3xx — łączenie
  KK301: { level: 'warning', title: 'Różne parametry w grupie' },
  KK302: { level: 'warning', title: 'Grupa za długa' },
  // KK4xx — timing (zgłasza synteza)
  KK401: { level: 'info', title: 'Wymagane przyspieszenie' },
  KK402: { level: 'warning', title: 'Wyjście poza slot' },
  KK403: { level: 'error', title: 'Zbyt duże opóźnienie' },
} as const satisfies Record<string, DiagnosticDefinition>;

export type KkCode = keyof typeof KK_DIAGNOSTICS;

/** Dane dołączane do wybranych kodów. */
export interface KkDiagnosticData {
  KK001: { key: string };
  KK002: { found: number; supported: number };
  KK006: { key: string; value: string };
  KK007: { label: string };
  KK009: { path: string };
  KK101: { symbols: string[] };
  KK102: { word: string };
  KK202: { digits: string };
  KK203: NumberExpansion;
  KK204: NumberExpansion;
  KK302: { tokens: number; limit: number };
  KK401: { speed: number };
  KK402: { overflow: Ms };
  KK403: { delay: Ms; maxDelay: Ms };
}

export type KkDiagnostic = DiagnosticUnion<typeof KK_DIAGNOSTICS, KkDiagnosticData>;

/** Wybiera z unii diagnostykę konkretnego kodu. */
export type KkDiagnosticOf<C extends KkCode> = Extract<KkDiagnostic, { code: C }>;
