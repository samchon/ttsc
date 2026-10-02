import type fs from "node:fs";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { isPossibleProgramFileName } from "./isPossibleProgramFileName";

/**
 * Conservatively select entries that can affect the walk's membership digest.
 *
 * A directory always could, since it can hold sources. A file could only if it
 * carries an extension the resolved configuration admits, which is what makes a
 * bundle emitted beside the sources invisible to a project that compiles no
 * JavaScript.
 * Non-file entries remain possible without proving that the walk follows them.
 * Directory admission and actual file hashing are separate decisions of the
 * walk; this predicate only supplies its membership-digest eligibility.
 *
 * @evidence contracts/common.md#principled-implementation Regular files use admitted extensions; non-file entries remain conservatively possible because topology can expose future source inputs.
 * @evidence contracts/common.md#clear-and-simple-design The Dirent wrapper delegates filename policy to the single helper also used by callers without an entry object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Admitted extensions come from the resolved policy rather than fixture-specific emitted-file names.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains future directory membership and why unadmitted emitted JavaScript does not invalidate a TypeScript-only program.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Classifies the already supplied entry-kind observation and bare filename eligibility; it selects no native backend, path grammar or identity policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Non-file kinds return before allocating normalized filename text. Regular
 *   files delegate one lowercase allocation and early-terminating suffix scan;
 *   cost follows filename length and the supplied extension population/text.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isPossibleProgramEntry(
  entry: fs.Dirent,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return entry.isFile() ? isPossibleProgramFileName(entry.name, policy) : true;
}
