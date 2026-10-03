/** Podpisy (§8.1) i centralny rejestr twórców (§8.2). */
import type { Base64, IsoDateTime } from '../common.js';

// ─── signatures.json ────────────────────────────────────────────────────────

/** Nazwa konta w rejestrze: `[a-z0-9_-]{3,32}`. */
export type CreatorName = string;

interface SignatureBase {
  alg: 'ed25519';
  /** Klucz publiczny, base64 32 B — zaufanie zawsze na nim, nie na nazwie. */
  publicKey: Base64;
  created: IsoDateTime;
  /** Podpis bajtów JCS `manifest.json`, base64 64 B. */
  signature: Base64;
}

/** `registry: "koko"` → `keyId` to nazwa konta w rejestrze. */
export interface RegistrySignature extends SignatureBase {
  registry: 'koko';
  keyId: CreatorName;
}

/** Bez `registry` → `keyId` to niezweryfikowana etykieta (KP014). */
export interface UnregisteredSignature extends SignatureBase {
  registry?: undefined;
  keyId: string;
}

export type PackSignature = RegistrySignature | UnregisteredSignature;

export interface SignaturesFile {
  version: 1;
  signatures: PackSignature[];
}

// ─── Rejestr: GET <rejestr>/v1/creators/<keyId> ─────────────────────────────

export type KeyRevocationReason = 'rotated' | 'compromised';

export interface RegistryKey {
  publicKey: Base64;
  added: IsoDateTime;
  revoked: { at: IsoDateTime; reason: KeyRevocationReason } | null;
}

/** Odpowiedź `200`. (`404` = brak konta.) */
export interface RegistryCreator {
  creator: CreatorName;
  displayName: string;
  keys: RegistryKey[];
}

/** Czas ważności cache odpowiedzi rejestru. */
export const REGISTRY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Zapis w cache Koko-Editor/Koko-Player. */
export interface RegistryCacheEntry {
  keyId: CreatorName;
  fetchedAt: IsoDateTime;
  response: RegistryCreator | null;
}

// ─── Wynik weryfikacji ──────────────────────────────────────────────────────

export type SignatureTrust =
  /** Klucz na liście konta, nieunieważniony. */
  | { status: 'verified'; creator: CreatorName; displayName: string }
  /** `rotated`, podpis sprzed wycofania. */
  | { status: 'verifiedRotated'; creator: CreatorName; displayName: string; revokedAt: IsoDateTime }
  /** Klucz z lokalnej listy zaufanych. */
  | { status: 'trustedLocally'; label: string }
  /** Bez `registry`, klucz spoza listy lokalnej (KP014) lub rejestr nieosiągalny (KP019). */
  | { status: 'unverified'; reason: 'noRegistry' | 'registryUnreachable'; label: string }
  /** KP013 / KP017 / KP018. */
  | { status: 'untrusted'; reason: 'badSignature' | 'revoked' | 'impersonation'; label: string };

export interface SignatureVerification {
  signature: PackSignature;
  trust: SignatureTrust;
}
