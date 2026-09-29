import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Fingerprint an absolute executable's spelling, target and actual bytes.
 *
 * A changed link, file, or read failure yields no reusable identity. Metadata
 * brackets the streamed read; it is not used to reuse an earlier content hash.
 * Concurrent writes that evade every filesystem observation remain outside this
 * snapshot guarantee.
 *
 * @evidence contracts/common.md#principled-implementation The identity joins lexical-link metadata, the selected physical file metadata and SHA-256 of that opened file; matching metadata alone cannot authorize reuse after bytes change. Descriptor and pathname observations must still agree after reading.
 * @evidence contracts/common.md#clear-and-simple-design This one native owner supplies the same content proof to runtime capability and plugin caches; callers decide whether their other inputs permit reuse.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported Node filesystem and crypto APIs inspect the actual candidate; no fixture identity, foreign mutation or metadata-only shortcut substitutes for content.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absolute-path scope, failure meaning, hash freshness and the remaining concurrent-mutation limitation, with separate prose and tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node native realpath and bigint stat preserve link/target identity on supported hosts; absolute paths use native platform semantics, and unreadable or non-regular targets cannot be reused.
 * @evidence contracts/performance.md#efficient-algorithms A sequential read hashes B bytes in O(B) time with one 64 KiB buffer; stat comparisons use fixed-size metadata and no complete executable allocation.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation establishes whether later work is equivalent; retaining a digest by metadata would reproduce the stale-byte defect it must prevent.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One descriptor and one fixed buffer belong to this synchronous call; finally closes the descriptor on every read or observation failure, and only the fixed-size identity escapes.
 */
export function runtimeExecutableIdentity(runtime: string): string | undefined {
  if (!path.isAbsolute(runtime)) return undefined;
  let descriptor: number | undefined;
  try {
    const lexical = fs.lstatSync(runtime, { bigint: true });
    const physicalPath = fs.realpathSync.native(runtime);
    const physical = fs.statSync(physicalPath, { bigint: true });
    if (!physical.isFile()) return undefined;
    descriptor = fs.openSync(physicalPath, "r");
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (fileIdentity(opened) !== fileIdentity(physical)) return undefined;
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let remaining = opened.size;
    while (remaining > 0n) {
      const requested =
        remaining > BigInt(buffer.length) ? buffer.length : Number(remaining);
      const length = fs.readSync(descriptor, buffer, 0, requested, null);
      if (length === 0) return undefined;
      hash.update(buffer.subarray(0, length));
      remaining -= BigInt(length);
    }
    if (
      fileIdentity(fs.fstatSync(descriptor, { bigint: true })) !==
        fileIdentity(opened) ||
      fs.realpathSync.native(runtime) !== physicalPath ||
      fileIdentity(fs.lstatSync(runtime, { bigint: true })) !==
        fileIdentity(lexical) ||
      fileIdentity(fs.statSync(physicalPath, { bigint: true })) !==
        fileIdentity(physical)
    )
      return undefined;
    return [
      physicalPath,
      fileIdentity(lexical),
      fileIdentity(physical),
      hash.digest("hex"),
    ].join("\0");
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        return undefined;
      }
    }
  }
}

/** Bigint metadata distinguishes file replacement and observed writes. */
function fileIdentity(stat: fs.BigIntStats): string {
  return [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ].join("\0");
}
