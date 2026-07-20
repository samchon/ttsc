import { gzipSync } from "node:zlib";

const encoder = new TextEncoder();

export interface ITarEntry {
  body: string | Uint8Array;
  path: string;
  type?: "0" | "L" | "x";
}

/** Build a minimal gzip tarball for browser-side npm-loader feature tests. */
export function createTarball(entries: readonly ITarEntry[]): ArrayBuffer {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const body =
      typeof entry.body === "string" ? encoder.encode(entry.body) : entry.body;
    const header = new Uint8Array(512);
    header.set(encoder.encode(entry.path).subarray(0, 100), 0);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 124, 12, body.length);
    writeOctal(header, 136, 12, 0);
    header[156] = (entry.type ?? "0").charCodeAt(0);
    header.set(encoder.encode("ustar\0"), 257);
    blocks.push(
      header,
      body,
      new Uint8Array((512 - (body.length % 512)) % 512),
    );
  }
  blocks.push(new Uint8Array(1024));
  const tar = concat(blocks);
  const compressed = gzipSync(tar);
  return compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
}

/** Build one correctly length-prefixed PAX record in the byte domain. */
export function createPaxRecord(key: string, value: string): Uint8Array {
  for (let length = 1; length < 100_000; length++) {
    const record = `${length} ${key}=${value}\n`;
    const encoded = encoder.encode(record);
    if (encoded.length === length) return encoded;
  }
  throw new Error(`Could not encode PAX record ${key}.`);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function writeOctal(
  target: Uint8Array,
  offset: number,
  width: number,
  value: number,
): void {
  const encoded = encoder.encode(value.toString(8).padStart(width - 1, "0"));
  target.set(encoded, offset);
}
