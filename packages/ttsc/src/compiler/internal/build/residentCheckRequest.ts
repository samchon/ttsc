import path from "node:path";

import { type ResidentCheckRequest } from "../ResidentCheckRequest";
import type { ResidentCheckWatchChange } from "./ResidentCheckWatchChange";

/**
 * Translate one watch change into the line a resident check sidecar receives.
 *
 * Paths are resolved against `cwd`, deduplicated, and sorted, so two cycles
 * that observed the same edits in a different order send identical requests.
 * `reload` is not part of the wire protocol: the session handles it by
 * discarding its processes before any request is sent.
 *
 * @evidence contracts/common.md#principled-implementation Resolving and sorting sets gives order-independent wire paths; invalidation remains explicit and coordinator-only reload is omitted from the sidecar payload.
 * @evidence contracts/common.md#clear-and-simple-design One local normalizer serves changed and external lists, while the result literal exposes which nonempty wire fields are present.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only protocol-defined fields are emitted; reload is handled by the session rather than faked as a special changed filename.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish canonical path order from reload's separate session effect.
 * @evidence contracts/portability.md#os-neutral-implementation node:path resolves native spellings against the supplied cwd and collapses dot segments; it preserves case and does not resolve symlink targets or certify physical filesystem identity.
 * @evidence contracts/performance.md#efficient-algorithms Each supplied path is resolved directly into a set without an intermediate mapped array. Resolution and set membership include path-string work; sorting U distinct paths uses O(U log U) string comparisons, and temporary storage holds distinct path bytes plus returned references.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This converts one change event without coordinating a persistent producer; process reuse belongs to the session.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Local sets become returned arrays and this converter owns no retained watch buffer or sidecar.
 */
export function residentCheckRequest(
  change: ResidentCheckWatchChange,
  cwd: string,
): ResidentCheckRequest {
  const normalize = (values: readonly string[] | undefined): string[] => {
    const paths = new Set<string>();
    for (const value of values ?? []) paths.add(path.resolve(cwd, value));
    return [...paths].sort();
  };
  const changed = normalize(change.changed);
  const external = normalize(change.external);
  return {
    ...(change.invalidate === true ? { invalidate: true } : {}),
    ...(changed.length === 0 ? {} : { changed }),
    ...(external.length === 0 ? {} : { external }),
  };
}
