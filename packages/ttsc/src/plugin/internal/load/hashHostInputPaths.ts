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
 * @evidence contracts/performance.md#efficient-algorithms Each distinct resolved path incurs one native stat (or reuses an observation already recorded in an optional caller-owned phase map); a readable nondirectory allocates and hashes its full bytes, while directories hash a fixed kind marker without scanning children. Duplicate resolved keys skip repeated filesystem reads.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work An optional caller-owned phase map shares content hashes across overlapping checks within one synchronous verification phase and is dropped when that phase ends; without a map, each call rereads every distinct file anew.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous file APIs close their own descriptors and the returned record is caller-owned; this snapshot keeps no global collection or acquired handle.
 */
export function hashHostInputPaths(
  files: readonly string[],
  observed?: Map<string, string | null>,
  observe: (file: string) => string | null = hashHostInput,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const file of files) {
    const resolved = path.resolve(file);
    if (Object.prototype.hasOwnProperty.call(out, resolved)) continue;
    let digest: string | null;
    if (observed !== undefined && observed.has(resolved)) {
      digest = observed.get(resolved)!;
    } else {
      digest = observe(resolved);
      observed?.set(resolved, digest);
    }
    out[resolved] = digest;
  }
  return out;
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
