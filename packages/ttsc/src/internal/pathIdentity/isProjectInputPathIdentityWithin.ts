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
 */
export function isProjectInputPathIdentityWithin(
  root: string,
  candidate: string,
): boolean {
  return isFilesystemPathIdentityWithin(root, candidate);
}
