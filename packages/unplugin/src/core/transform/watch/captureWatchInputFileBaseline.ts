import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { stableStringify } from "../utils/stableStringify";
import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/**
 * Capture two equal file-predicate observations for implicit project discovery.
 * A failed stat records a negative file predicate. A mismatch or escaping
 * identity observation failure declines capture; equal samples do not establish
 * an atomic filesystem snapshot.
 *
 * @evidence contracts/common.md#principled-implementation Fresh identity and regular-file predicates are captured twice and compared structurally, preserving discovery's stat.isFile semantics rather than compiler byte-read semantics.
 * @evidence contracts/common.md#clear-and-simple-design A narrow local capture avoids broad graph and content facts that project discovery does not consume.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed stat remains a negative file predicate and an unstable identity declines capture; candidate names cannot manufacture successful availability.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies discovery, rejection and the sampling limitation, with a blank tag separator following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Supplied stat and identity operations determine native availability and case-sensitive identity, not an operating-system-wide casing rule.
 * @evidence contracts/performance.md#efficient-algorithms Two narrow observations read metadata and native identity only, with path/component work and any case-policy directory observation owned by identity resolution; no file bytes or subtree content are scanned for this discovery predicate.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each capture asks for independent current observations; the cache-key caller owns permission to reuse the resulting baseline.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Identity contexts and baseline objects remain call-local and no descriptor or task is acquired.
 */
export function captureWatchInputFileBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscWatchInputFileBaseline | undefined {
  const capture = (): TtscWatchInputFileBaseline => {
    const identities = createHostPathIdentityContext(filesystem);
    let fileExists = false;
    try {
      fileExists = filesystem.stat(file).isFile();
    } catch {
      // Project discovery rejects every candidate not proven to be a file.
    }
    return {
      fileExists,
      identity: pathIdentityKey(file, identities),
    };
  };
  try {
    const before = capture();
    const after = capture();
    return stableStringify(before) === stableStringify(after)
      ? after
      : undefined;
  } catch {
    return undefined;
  }
}
