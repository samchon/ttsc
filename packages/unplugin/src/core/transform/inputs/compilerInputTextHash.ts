import { hashText } from "../utils/hashText";

/**
 * Hash one observed byte buffer under the compiler's BOM decoding rules. UTF-16
 * omits an incomplete trailing unit and big-endian decoding copies its slice
 * before swapping; raw host hashing can still consume the original bytes.
 *
 * @evidence contracts/common.md#principled-implementation Compiler text decoding removes UTF BOMs and preserves the existing incomplete UTF-16 unit rule before hashing.
 * @evidence contracts/common.md#clear-and-simple-design One byte-to-text hash owner lets a current observation share its actual read across compiler and host codecs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied observed bytes determine the hash; no expected digest or stale filesystem reading substitutes for them.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains decoding and the original buffer's continued raw-byte availability.
 * @evidence contracts/portability.md#os-neutral-implementation Encoding comes from observed BOM bytes, independently of platform defaults; big-endian decoding copies before swapping and leaves raw input unchanged.
 * @evidence contracts/performance.md#efficient-algorithms Decoding and hashing scan B bytes; UTF-8 slices share storage, while UTF-16 decoding allocates proportional text and big-endian input requires a copy.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller can derive both codecs from one current read; this pure decoder retains no cross-observation cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the digest escapes; temporary decoded text and copied bytes remain call-local.
 */
export function compilerInputTextHash(bytes: Buffer): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const even = bytes.subarray(2, 2 + Math.floor((bytes.length - 2) / 2) * 2);
    return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const even = Buffer.from(
      bytes.subarray(2, 2 + Math.floor((bytes.length - 2) / 2) * 2),
    );
    even.swap16();
    return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
  }
  return hashText(
    bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
      ? bytes.subarray(3)
      : bytes,
  );
}
