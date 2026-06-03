/**
 * Wire protocol shared by the Node loader and the native emit host
 * (`driver.RunEmitServer`). Each message is a 4-byte big-endian length followed
 * by that many bytes of UTF-8 JSON. Kept dependency-free so it loads in the
 * child's plain Node runtime alongside the loader hooks.
 */

/** Request: emit `file` using the program of its owning `tsconfig`. */
export interface EmitRequest {
  tsconfig: string;
  file: string;
}

/** Response: the emitted JavaScript, or an error message. */
export interface EmitResponse {
  code?: string;
  error?: string;
}

/** Encode one length-prefixed frame around a UTF-8 JSON payload. */
export function encodeFrame(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

/**
 * Incrementally decodes length-prefixed frames from a byte stream. Feed chunks
 * with `push`; each completed frame's JSON payload is returned by `next` until
 * the buffer is drained.
 */
export class FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): void {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
  }

  /** Return the next complete frame's parsed payload, or null if incomplete. */
  next(): unknown | null {
    if (this.buffer.length < 4) {
      return null;
    }
    const size = this.buffer.readUInt32BE(0);
    if (this.buffer.length < 4 + size) {
      return null;
    }
    const payload = this.buffer.subarray(4, 4 + size);
    this.buffer = this.buffer.subarray(4 + size);
    return JSON.parse(payload.toString("utf8"));
  }
}
