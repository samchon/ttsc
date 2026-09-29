import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";
import { compilerStatKind } from "./compilerStatKind";

/**
 * Hash a successful compiler-style text read, or return null for a directory or
 * failed read. UTF BOMs are removed; UTF-16 BOM input is decoded to UTF-8, with
 * an incomplete trailing code unit omitted. The supplied kind must come from
 * the same filesystem observation when a caller already has one.
 *
 * @evidence contracts/common.md#principled-implementation BOM handling reproduces compiler text normalization before SHA-256; directory classification rejects byte reads while stat-missing paths still attempt the compiler read predicate.
 * @evidence contracts/common.md#clear-and-simple-design One read adapter owns text decoding and optional kind reuse without substituting directory sentinel hashes for read results.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts BOM constants are encoding discriminants, not expected hashes; failed reads remain null instead of manufactured content.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes failure, BOM normalization, incomplete units and observed-kind provenance, with separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral reads use the supplied filesystem and encoding bytes; big-endian UTF-16 is copied before swapping so a shared Buffer is not mutated.
 * @evidence contracts/performance.md#efficient-algorithms Work is O(B) in input bytes with O(B) decoding space for UTF-16; UTF-8 and BOM stripping use shared slices, and an existing kind avoids a second stat.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This performs a fresh read within one observation; consumers own cross-request hash reuse and its metadata proof.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Buffers and hash state are call-local; no persistent descriptor, task or retained cache is acquired here.
 */
export function graphInputReadHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  observedKind?: "directory" | "file" | "missing",
): string | null {
  const kind = observedKind ?? compilerStatKind(file, filesystem);
  try {
    if (kind === "directory") return null;
    const bytes = filesystem.readFile(file);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      const even = bytes.subarray(
        2,
        2 + Math.floor((bytes.length - 2) / 2) * 2,
      );
      return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      const even = Buffer.from(
        bytes.subarray(2, 2 + Math.floor((bytes.length - 2) / 2) * 2),
      );
      even.swap16();
      return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
    }
    const content =
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
        ? bytes.subarray(3)
        : bytes;
    return hashText(content);
  } catch {
    return null;
  }
}
