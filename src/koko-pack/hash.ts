/** SHA-256 w zapisie `sha256:<hex>` i odcisk pliku wideo (Koko-Pack §3). */
import type { Sha256, VideoFingerprint } from '../types/index.js';

export async function sha256(data: Uint8Array): Promise<Sha256> {
  const digest = await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

const MIB = 1024 * 1024;

/** `sha256` z pierwszego i ostatniego 1 MiB + rozmiar jako 8 B little-endian. */
export async function videoFingerprint(file: Blob): Promise<VideoFingerprint> {
  const head = new Uint8Array(await file.slice(0, MIB).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(0, file.size - MIB)).arrayBuffer());

  const size = new Uint8Array(8);
  new DataView(size.buffer).setBigUint64(0, BigInt(file.size), true);

  const data = new Uint8Array(head.length + tail.length + size.length);
  data.set(head, 0);
  data.set(tail, head.length);
  data.set(size, head.length + tail.length);
  return sha256(data);
}
