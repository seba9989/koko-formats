import { readFileSync } from 'node:fs';

export const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** Kody diagnostyk w kolejności. */
export const codes = (diagnostics: readonly { code: string }[]): string[] => diagnostics.map((d) => d.code);
