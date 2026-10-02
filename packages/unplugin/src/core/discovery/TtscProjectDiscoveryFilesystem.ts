import type fs from "node:fs";

/**
 * Filesystem facts required to discover an implicit TypeScript project.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Platform syntax and link-following file predicates describe the two facts
 *   needed for an ancestor config walk, without requiring file-content access.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The smallest discovery boundary supports both the host and explicit
 *   alternate filesystem views; tree enumeration extends this interface.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Callers replace an explicit observation boundary rather than patching
 *   global filesystem methods or synthesizing consumer-specific selection.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member comments explain syntax override and link following, preserving
 *   native member documentation with blank lines between documented members.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Platform syntax is explicit for non-host views and stat supplies observed
 *   link-following capabilities; the type makes no filesystem case-policy claim.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Ancestor-walk implementations own candidate/path work and native stat cost;
 *   this boundary specifies predicates without selecting their processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Discovery callers own observation timing and any valid reuse; this boundary
 *   grants no cached or stable-result capability.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Supplied stat implementations own native access resources, and callers own
 *   retained candidate records; this boundary specifies no acquired handle.
 */
export interface TtscProjectDiscoveryFilesystem {
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;

  /**
   * Read metadata while following links, like an ordinary config-file open.
   *
   * @evidence contracts/common.md#principled-implementation
   *   isFile supplies the predicate discovery uses to select a regular config;
   *   optional isDirectory supports linked traversal through the derived boundary.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   The callback returns only metadata predicates discovery actually consumes.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The callback is an explicit dependency rather than a patched global stat.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The comment states link-following semantics, which distinguish stat from
   *   a link-preserving observation; prose and tags have a blank comment line.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   The location is a native filename interpreted by its filesystem view;
   *   the returned predicates express observed kind, not platform-name guesses.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of stat is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of stat is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of stat is declared here; the cost belongs to its
   *   implementation.
   */
  stat(
    location: string,
  ): Pick<fs.Stats, "isFile"> & Partial<Pick<fs.Stats, "isDirectory">>;
}
