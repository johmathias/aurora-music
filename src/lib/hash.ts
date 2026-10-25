// Gives every audio file a stable id from its CONTENT (not its name),
// so importing the same song twice is detected as a duplicate.

function fnv(bytes: Uint8Array, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Hash of file size + first 64 KB + last 64 KB. Fast, even for big files. */
export async function fileFingerprint(blob: Blob): Promise<string> {
  const chunk = 64 * 1024;
  const head = new Uint8Array(await blob.slice(0, chunk).arrayBuffer());
  const tail =
    blob.size > chunk * 2
      ? new Uint8Array(await blob.slice(blob.size - chunk).arrayBuffer())
      : new Uint8Array(0);
  const a = fnv(head, 2166136261);
  const b = fnv(tail, a ^ blob.size);
  return `${blob.size.toString(36)}-${a.toString(36)}-${b.toString(36)}`;
}

/** Hash for picture data. Samples the bytes so big pictures stay fast. */
export function bytesFingerprint(bytes: Uint8Array): string {
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i += step) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return `${bytes.length.toString(36)}-${(h >>> 0).toString(36)}`;
}
