import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Content hash of each host input, keyed by its resolved path; `null` for an
 * input that cannot be read. A persistent plugin cache compares these against
 * the hashes it recorded to decide whether a descriptor must be evaluated
 * again.
 *
 * @evidence contracts/common.md#principled-implementation Resolved path keys pair readable content with SHA-256, directory kind with a domain marker, and unavailable input with null; consumers must pair this content projection with physical identity.
 * @evidence contracts/common.md#clear-and-simple-design The operation snapshots supplied inputs only, leaving discovery, read-time stability and cache acceptance with their respective owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The directory marker encodes type, not an expected answer; unreadability stays null rather than synthetic content or a known-path bypass.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states null's unreadable meaning and downstream comparison purpose; descriptive and acknowledgment paragraphs are separated following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve/stat/readFile preserve host path semantics and follow links; directory kind comes from actual stat rather than separators or platform-name inference.
 * @evidence contracts/performance.md#efficient-algorithms Each input incurs native key normalization and stat; a readable nondirectory allocates and hashes its full bytes, while directories hash a fixed kind marker without scanning children. Processing includes input/path text, native queries and readable file bytes; mapped pairs and the result coexist, and duplicate keys still repeat observation before overwriting. Each file read needs a buffer proportional to its complete size.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This current-state snapshot must reread its supplied files; reusable accepted answers belong to the cache that validates these observations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous file APIs close their own descriptors and the returned record is caller-owned; this snapshot keeps no global collection or acquired handle.
 */
export function hashHostInputPaths(
  files: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    files.map((file) => [path.resolve(file), hashHostInput(file)]),
  );
}

function hashHostInput(file: string): string | null {
  try {
    if (fs.statSync(file).isDirectory()) {
      return crypto
        .createHash("sha256")
        .update("ttsc:host-input:directory\0")
        .digest("hex");
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
  } catch {
    return null;
  }
}
