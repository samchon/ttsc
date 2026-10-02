import type fs from "node:fs";

import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";

/**
 * Directory enumeration required to discover every implicit child project.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Enumeration adds child name/kind predicates and optional physical identity
 *   to ancestor discovery; identity absence remains expressible for completeness.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Extending the smaller discovery view preserves one stat contract while
 *   adding only operations needed to descend and cut link cycles.
 *
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Linked traversal uses the supplied identity operation, not a guessed
 *   directory-name cycle rule or patched fs exports.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member comments distinguish lexical enumeration and physical identity;
 *   documented members remain separated by source blank lines.
 */
export interface TtscProjectTreeDiscoveryFilesystem extends TtscProjectDiscoveryFilesystem {
  /**
   * Enumerate one lexical directory and identify child directory links.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Name and directory predicates describe entries; optional link predicates
   *   let traversal request target metadata without mistaking a link for a file.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   One callback observes one directory, leaving traversal order to its caller.
   *
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Results come from the filesystem view rather than a fixture name table.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose states lexical enumeration and link identification, the
   *   distinctions needed to supply a compatible observation implementation.
   */
  readdir(
    location: string,
  ): readonly (Pick<fs.Dirent, "isDirectory" | "name"> &
    Partial<Pick<fs.Dirent, "isSymbolicLink">>)[];

  /**
   * Resolve physical directory identity for cycle-safe linked traversal.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A canonical physical spelling lets a branch recognize an ancestor reached
   *   through a different link. Absence does not assert physical completeness.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   Optional identity access is distinct from lexical enumeration and stat.
   *
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The signature requests actual identity rather than inferring it from OS
   *   name or an expected traversal path.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The native comment explains the cycle-safety role; the type keeps its
   *   optionality visible and prose is separated from acknowledgment tags.
   */
  realpath?(location: string): string;
}
