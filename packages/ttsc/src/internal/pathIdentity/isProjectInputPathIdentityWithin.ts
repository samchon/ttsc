import { isFilesystemPathIdentityWithin } from "./isFilesystemPathIdentityWithin";

/**
 * Whether one project-input identity key contains another, using the host
 * platform's separator; the project-input name of
 * {@link isFilesystemPathIdentityWithin}.
 *
 * @evidence contracts/common.md#principled-implementation Delegation preserves canonical-key equality and separator-boundary containment for project inputs with the same premises as filesystem identity.
 * @evidence contracts/common.md#clear-and-simple-design The project-facing name introduces no independent containment policy; the filesystem predicate remains the owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No project-specific path exception or foreign mutation bypasses the canonical-key predicate.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the identity-key inputs and shared owner, without suggesting raw lexical paths have been physically resolved.
 * @evidence contracts/portability.md#os-neutral-implementation The host separator is obtained by the shared predicate while case and alias equivalence must already be encoded in its input keys.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The delegated lexical query owns no native handle, persistent cache or created artifact; this domain adapter adds no retained state.
 * @evidence contracts/performance.md#efficient-algorithms Delegation performs the shared equality and separator-prefix comparisons, with string work and temporary suffix text dependent on input key lengths. This adapter adds no native lookup or descendant enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The adapter receives precomputed identity keys and introduces no producer or mutable observations to share. Identity construction and transaction reuse remain with the caller's context, rather than a second cache here.
 */
export function isProjectInputPathIdentityWithin(
  root: string,
  candidate: string,
): boolean {
  return isFilesystemPathIdentityWithin(root, candidate);
}
