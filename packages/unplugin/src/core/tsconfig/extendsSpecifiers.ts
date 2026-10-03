/**
 * Normalize the extends field into ordered string specifiers.
 *
 * Invalid shapes and non-string array elements contribute no base; the compiler
 * owns their diagnostics.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Scalar strings become one-element lists; arrays keep valid string entries
 *   in declaration order so priority remains available to each reader.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns shape normalization only; resolution and merge order stay
 *   with readers of the resulting specifiers.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It invents no default preset for malformed data and does not recognize
 *   fixture-specific extends values.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states ordering and invalid-shape handling, preserving the
 *   distinction between normalization and compiler diagnostics.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Normalizes the shape of an extends value into strings; it reads no filesystem and parses no path.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One array filter tests each element once and allocates at most one retained
 *   slot per string; scalar and invalid-shape branches allocate a fixed-size list.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Shape normalization coordinates no completed or in-flight work across
 *   requests; config readers own parsed-source sharing and native resolution.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function extendsSpecifiers(extended: unknown): string[] {
  if (typeof extended === "string") {
    return [extended];
  }
  if (Array.isArray(extended)) {
    return extended.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return [];
}
