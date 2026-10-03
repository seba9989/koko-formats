/**
 * Kontener ZIP (Koko-Pack §1–2, §8): wykrywanie, odczyt z kontrolą ścieżek
 * i limitów oraz zapis z `mimetype` jako pierwszym wpisem STORED.
 */
import { unzipSync, zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { KOKO_PACK_MAGIC, KOKO_PACK_MIME, PACK_LIMITS, PACK_PATHS } from '../types/index.js';
import type { KpDiagnosticData, ZipMethod } from '../types/index.js';
import { kp } from './diagnostics.js';
import type { PackDiagnostic } from './diagnostics.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8 = (text: string): Uint8Array => encoder.encode(text);
export const fromUtf8 = (bytes: Uint8Array): string => decoder.decode(bytes);

/** JSON z pliku w paczce; `undefined`, gdy pliku brak lub JSON jest zepsuty (schemat zgłosi błąd). */
export function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(fromUtf8(bytes));
  } catch {
    return undefined;
  }
}

// ─── Wykrywanie ─────────────────────────────────────────────────────────────

/**
 * Pierwszy wpis to `mimetype`, STORED, bez pola extra i deskryptora danych,
 * z dokładną treścią (offset 30 = nazwa, offset 38 = typ MIME).
 */
export function hasMimetypeHeader(bytes: Uint8Array): boolean {
  const { mimetypeNameOffset: nameAt, mimetypeValueOffset: valueAt, mimetypeLength: length } = KOKO_PACK_MAGIC;
  if (bytes.length < valueAt + length) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const localHeader = view.getUint32(0, true) === 0x04034b50;
  const noDescriptor = (view.getUint16(6, true) & 0x0008) === 0;
  const stored = view.getUint16(8, true) === 0;
  const sizes = view.getUint32(18, true) === length && view.getUint32(22, true) === length;
  const nameLength = view.getUint16(26, true) === 'mimetype'.length;
  const noExtra = view.getUint16(28, true) === 0;

  return (
    localHeader && noDescriptor && stored && sizes && nameLength && noExtra &&
    fromUtf8(bytes.subarray(nameAt, valueAt)) === PACK_PATHS.mimetype &&
    fromUtf8(bytes.subarray(valueAt, valueAt + length)) === KOKO_PACK_MIME
  );
}

// ─── Odczyt ─────────────────────────────────────────────────────────────────

export interface ZipEntryInfo {
  path: string;
  method: ZipMethod | 'other';
  size: number;
  originalSize: number;
}

export interface ReadZip {
  entries: ZipEntryInfo[];
  files: Map<string, Uint8Array>;
}

const ROOT_FILES: readonly string[] = [
  PACK_PATHS.mimetype, PACK_PATHS.manifest, PACK_PATHS.subtitles, PACK_PATHS.timeline, PACK_PATHS.signatures,
];
const isRootDir = (dir: string) => dir === 'audio' || dir === 'cache' || /^x-[^/]+$/.test(dir);
const isText = (path: string) => path.endsWith('.json') || path.endsWith('.ass');

type PathProblem = KpDiagnosticData['KP007']['reason'];

/** Sprawdzane PRZED rozpakowaniem (zip slip, duplikaty, nieznane pliki). Symlinków fflate nie zgłasza. */
function pathProblem(path: string, seen: Set<string>): PathProblem | null {
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return 'absolute';
  if (path.includes('\\')) return 'backslash';
  if (path.split('/').some((segment) => segment === '.' || segment === '..')) return 'dotSegment';
  if (seen.has(path)) return 'duplicate';

  const slash = path.indexOf('/');
  const known = slash < 0 ? ROOT_FILES.includes(path) : isRootDir(path.slice(0, slash));
  return known ? null : 'unknownRootEntry';
}

function sizeProblem(entry: ZipEntryInfo): boolean {
  if (isText(entry.path) && entry.originalSize > PACK_LIMITS.maxTextBytes) return true;
  return entry.size > 0 && entry.originalSize / entry.size > PACK_LIMITS.maxCompressionRatio;
}

/** `null` przy KP001 (uszkodzony ZIP) lub KP007 — paczka odrzucona. */
export function readZip(bytes: Uint8Array, diagnostics: PackDiagnostic[]): ReadZip | null {
  const entries: ZipEntryInfo[] = [];
  const seen = new Set<string>();
  let rejected = false;

  const reject = (path: string, reason: PathProblem) => {
    diagnostics.push(kp('KP007', `${path}: ${reason}`, { path, reason }));
    rejected = true;
  };

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        const entry: ZipEntryInfo = {
          path: file.name,
          method: file.compression === 0 ? 'stored' : file.compression === 8 ? 'deflate' : 'other',
          size: file.size,
          originalSize: file.originalSize,
        };
        entries.push(entry);

        const problem = pathProblem(file.name, seen);
        seen.add(file.name);
        if (problem) reject(file.name, problem);
        else if (sizeProblem(entry)) reject(file.name, 'tooLarge');

        return !rejected && !file.name.endsWith('/'); // katalogi pomijamy
      },
    });
  } catch (error) {
    diagnostics.push(kp('KP001', `Uszkodzony ZIP: ${String(error)}`));
    return null;
  }

  return rejected ? null : { entries, files: new Map(Object.entries(files)) };
}

// ─── Zapis ──────────────────────────────────────────────────────────────────

export interface ZipFile {
  path: string;
  data: Uint8Array;
  method: ZipMethod;
}

/** Kolejność wpisów = kolejność tablicy; `mimetype` musi być pierwszy i `stored`. */
export function writeZip(files: readonly ZipFile[]): Uint8Array {
  const zippable: Zippable = {};
  for (const { path, data, method } of files) {
    zippable[path] = [data, { level: method === 'stored' ? 0 : 6 }];
  }
  return zipSync(zippable);
}
