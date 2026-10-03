/** Tworzenie diagnostyk KP (i KK zgłaszanych przez aplikację). */
import { KK_DIAGNOSTICS, KP_DIAGNOSTICS } from '../types/index.js';
import type { KkDiagnostic, KpCode, KpDiagnostic, KpDiagnosticData, KpDiagnosticOf } from '../types/index.js';

export type PackDiagnostic = KpDiagnostic | KkDiagnostic;

type DataArgs<C extends KpCode> = C extends keyof KpDiagnosticData ? [data: KpDiagnosticData[C]] : [];

export function kp<C extends KpCode>(code: C, message: string, ...data: DataArgs<C>): KpDiagnosticOf<C> {
  const diagnostic = { code, level: KP_DIAGNOSTICS[code].level, message, ...(data.length > 0 && { data: data[0] }) };
  return diagnostic as unknown as KpDiagnosticOf<C>;
}

/** KK008 — wideo nie pasuje do żadnego źródła (zgłasza aplikacja). */
export const kk008 = (): KkDiagnostic => ({ code: 'KK008', level: KK_DIAGNOSTICS.KK008.level, message: 'Wideo nie pasuje do żadnego źródła' });

export const isError = (d: PackDiagnostic): boolean => d.level === 'error';
