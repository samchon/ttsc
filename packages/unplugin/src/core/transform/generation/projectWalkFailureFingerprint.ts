import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscProjectWalkFailure } from "../project/TtscProjectWalkFailure";
import { toProjectKey } from "../project/toProjectKey";
import { hashText } from "../utils/hashText";
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";

/**
 * Hash the walk's declared-input-relevant failure shape for terminal retry
 * comparison. File failures outside the declared keys are ignored; directory
 * failures and unidentifiable paths remain relevant to walk completeness.
 * Sorted failure/unstable lists make observation order irrelevant.
 *
 * This records producer classifications and resolved diagnostic spellings,
 * rather than reopening paths to obtain error messages. Identity filtering
 * shares the caller's observation transaction and may perform its native
 * probes. A digest difference confirms a changed failure shape, not that a new
 * generation can succeed.
 *
 * @evidence contracts/common.md#principled-implementation Declared keys filter only file failures with resolvable identity; completeness, directory completeness and sorted kind/path observations preserve the failure shape under hashText's digest comparison premise.
 * @evidence contracts/common.md#clear-and-simple-design This helper produces a compact comparison fingerprint while walkSnapshotComplete owns completeness semantics and toProjectKey owns filesystem identity mapping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unidentifiable failed paths remain included rather than being dropped to manufacture a complete walk, and directory failures are not excused by declared-file selection.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain declared filtering, conservative identity failure, order-insensitive fingerprinting and its confirmation-only role before separated acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Node resolves diagnostic native paths while toProjectKey uses the supplied filesystem identity context; no protocol slash or OS-name case assumption replaces path identity.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Copies all unstable keys and scans all failures before sorting selected
 *   collections, preserving the borrowed snapshot's order. Set lookups retain
 *   key-text cost; declared file failures delegate native identity resolution
 *   and containment to the supplied transaction. Completeness may scan unstable
 *   keys again. Selected path resolution, string comparisons, JSON encoding
 *   and UTF-8 hashing scale with diagnostic/key text; temporary arrays and
 *   encoded text grow with the supplied and selected populations. Sorting is
 *   needed because failure observation order is not retry identity.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   File filtering reuses path and directory-capability observations through
 *   the caller's identity transaction. The completed fingerprint is not cached
 *   here; terminal validation stores the baseline and compares a new snapshot.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Temporary filtered/sorted arrays transfer only a digest string; no retained cache, handle or generation lifecycle is owned here.
 */
export function projectWalkFailureFingerprint(
  snapshot: {
    /** Whether selected directory and file observations were coherent. */
    complete: boolean;

    /** Whether relevant directory enumeration completed. */
    directoryComplete: boolean;

    /** Relative or full project identity keys with unstable observations. */
    unstableFiles: ReadonlySet<string>;

    /** Native failed-path observations and their producer classifications. */
    walkFailures: readonly TtscProjectWalkFailure[];
  },
  declared: ReadonlySet<string> | undefined,
  projectRoot: string,
  identities: FilesystemPathIdentityContext,
): string {
  const relevantUnstableFiles =
    declared === undefined
      ? [...snapshot.unstableFiles]
      : [...snapshot.unstableFiles].filter((key) => declared.has(key));
  const relevantFailures = snapshot.walkFailures.filter((failure) => {
    if (!failure.kind.startsWith("file-")) return true;
    if (declared === undefined) return true;
    try {
      return declared.has(toProjectKey(projectRoot, failure.path, identities));
    } catch {
      return true;
    }
  });
  return hashText(
    JSON.stringify({
      complete: walkSnapshotComplete(snapshot, declared),
      directoryComplete: snapshot.directoryComplete,
      failures: relevantFailures
        .map((failure) => `${failure.kind}\0${path.resolve(failure.path)}`)
        .sort(),
      unstableFiles: relevantUnstableFiles.sort(),
    }),
  );
}
