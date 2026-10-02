import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { createHostPathIdentityContext } from "./createHostPathIdentityContext";

/**
 * Build a comparison key for a path without changing the spelling handed to a
 * filesystem or bundler. Physical path spelling and the nearest existing
 * directory's case policy keep case-sensitive files distinct on every OS.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared filesystem resolver expands native aliases and judges missing
 *   suffix spelling by directory capability; its key represents file identity.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This wrapper extracts the key from one supplied transaction context rather
 *   than duplicating native equivalence policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Case policy and physical spelling come from the resolver, not a blanket
 *   Windows/macOS lowercase rule or consumer-specific path exceptions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes comparison from delivered spelling and states
 *   per-directory case semantics, separated from tags per documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral comparison follows the supplied filesystem identity context's
 *   native aliases and observed directory case policy. The returned key never
 *   substitutes for the original path spelling supplied to a host or read.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function pathIdentityKey(
  file: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
): string {
  return identities.resolve(file).key;
}
