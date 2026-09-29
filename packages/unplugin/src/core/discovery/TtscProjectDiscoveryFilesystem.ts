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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Platform syntax is explicit for non-host views and stat supplies observed
 *   link-following capabilities; the type makes no filesystem case-policy claim.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Callers replace an explicit observation boundary rather than patching
 *   global filesystem methods or synthesizing consumer-specific selection.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member comments explain syntax override and link following, preserving
 *   native member documentation with blank lines between documented members.
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
   * @evidence contracts/portability.md#os-neutral-implementation
   *   The location is a native filename interpreted by its filesystem view;
   *   the returned predicates express observed kind, not platform-name guesses.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The callback is an explicit dependency rather than a patched global stat.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The comment states link-following semantics, which distinguish stat from
   *   a link-preserving observation; prose and tags have a blank comment line.
   */
  stat(
    location: string,
  ): Pick<fs.Stats, "isFile"> & Partial<Pick<fs.Stats, "isDirectory">>;
}
