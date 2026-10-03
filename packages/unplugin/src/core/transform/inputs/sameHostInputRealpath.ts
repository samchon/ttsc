import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { pathIdentityKey } from "../filesystem/pathIdentityKey";

/**
 * Compare reported physical targets through the supplied filesystem identity
 * context. Undefined recorded evidence never matches; two failed resolutions
 * represented by null do match. Comparison does not rewrite delivered paths.
 *
 * @evidence contracts/common.md#principled-implementation Absence, resolution failure and resolved identity are distinguished before comparing context-produced keys for two successful observations.
 * @evidence contracts/common.md#clear-and-simple-design One shared identity context owns native equivalence; this adapter handles only optional-result states and key equality.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Realpath equality does not rely on blanket lowercase, removed separators or consumer-specific spelling exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose states undefined and null meaning and separates comparison from rewriting, with a blank acknowledgment separator under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral comparison uses the context's native aliases and directory case policy rather than OS-name case rules; original resolver spelling remains intact.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms
 *   At most two context resolutions and key comparison process native path
 *   components and text; uncached resolver observations remain part of this cost.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Both targets use the same supplied context's resolution memo. Its owner
 *   controls the current observation lifetime; this predicate retains no verdict.
 */
export function sameHostInputRealpath(
  left: string | null | undefined,
  right: string | null,
  identities: FilesystemPathIdentityContext,
): boolean {
  if (left === undefined || (left === null) !== (right === null)) return false;
  if (left === null || right === null) return true;
  return (
    pathIdentityKey(left, identities) === pathIdentityKey(right, identities)
  );
}
