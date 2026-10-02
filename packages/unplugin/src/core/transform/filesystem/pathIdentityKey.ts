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
 * @evidence contracts/performance.md#efficient-algorithms
 *   One resolver query performs native path normalization and, when uncached,
 *   ancestor and directory-case observations. The wrapper allocates no second
 *   identity representation or directory traversal beyond that required query.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A supplied transaction reuses its memoized path, realpath and case answers.
 *   Omission creates a fresh transaction, so no historical filesystem result
 *   crosses unrelated calls through a hidden cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The caller owns a supplied context's lifetime. An implicitly created
 *   context becomes unreachable after the synchronous return or throw; its
 *   maps grow only with this resolution's visited paths and ancestors.
 */
export function pathIdentityKey(
  file: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
): string {
  return identities.resolve(file).key;
}
