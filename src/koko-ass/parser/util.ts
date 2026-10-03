/** Małe pomocniki wspólne dla całego parsera. */
import { KK_DIAGNOSTICS } from '../../types/index.js';
import type { AssFieldName, KkCode, KkDiagnostic, KkDiagnosticData, KkDiagnosticOf } from '../../types/index.js';

// ─── Zawężanie napisów ──────────────────────────────────────────────────────

/** `v` należy do `list` → `v` ma typ elementów listy. */
export function isOneOf<T extends string>(list: readonly T[], v: string): v is T {
  return (list as readonly string[]).includes(v);
}

/** Nazwa z listy, porównana bez rozróżniania wielkości liter, w pisowni kanonicznej. */
export function findName<T extends string>(list: readonly T[], name: string): T | undefined {
  const lower = name.toLowerCase();
  return list.find((n) => n.toLowerCase() === lower);
}

// ─── Kolumny ASS ────────────────────────────────────────────────────────────

/** Dzieli na `n` pól; ostatnie (Text) zachowuje swoje przecinki. */
export function splitN(value: string, n: number): string[] {
  const parts = value.split(',');
  return [...parts.slice(0, n - 1), parts.slice(n - 1).join(',')];
}

/** `PrimaryColour` → `primaryColour`; stare pliki mają `Actor` zamiast `Name`. */
export function toField<C extends string>(column: C): AssFieldName<C> | 'name' {
  if (column === 'Actor') return 'name';
  return (column.charAt(0).toLowerCase() + column.slice(1)) as AssFieldName<C>;
}

// ─── Diagnostyka ────────────────────────────────────────────────────────────

type DataArgs<C extends KkCode> = C extends keyof KkDiagnosticData
  ? [data: KkDiagnosticData[C], message?: string]
  : [data?: undefined, message?: string];

/**
 * Zgłasza diagnostykę w jednej sekcji; `data` wymagane dokładnie dla kodów,
 * które je mają. `message` — np. opis błędu walidacji z arktype.
 */
export type Report = <C extends KkCode>(code: C, line: number, ...args: DataArgs<C>) => void;

export function reporter(diagnostics: KkDiagnostic[], section: string): Report {
  return (code, line, ...args) => {
    const [data, message] = args;
    const diagnostic = {
      code,
      level: KK_DIAGNOSTICS[code].level,
      location: { section, line },
      ...(data !== undefined && { data }),
      ...(message !== undefined && { message }),
    };
    // Poziom wynika z tabeli KK_DIAGNOSTICS — TypeScript nie umie tego połączyć z `code` sam.
    diagnostics.push(diagnostic as unknown as KkDiagnosticOf<typeof code>);
  };
}
