import crypto from "node:crypto";

/**
 * SHA-256 hex digest of text or bytes.
 *
 * The single content fingerprint every generation proof uses, so hashes
 * recorded at capture and recomputed during validation are always comparable.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node's SHA-256 hashes strings as UTF-8 and Buffer bytes directly; hex
 *   supplies the uniform content fingerprint generation readers compare.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One helper owns algorithm and encoding selection for content evidence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The digest is computed from supplied contents rather than expected results.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose names algorithm, encoding and shared validation purpose with
 *   a blank acknowledgment separator following documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Hashes bytes with node:crypto; no path or OS-specific behaviour.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function hashText(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
