import path from "node:path";

import type { TtscProjectSpellings } from "./TtscProjectSpellings";
import { pathIsWithin } from "./pathIsWithin";

/**
 * The path of a file below the project, under whichever of the project root's
 * two spellings contains it, or `undefined` when neither does.
 *
 * An empty string names the root itself. A file spelled under the physical root
 * and one spelled under the named root are both the project's, so a containment
 * decided against one spelling alone refused every input the compiler reported
 * for a project reached through a link.
 *
 * @param file The absolute path to place.
 * @param project The project root's two spellings.
 * @param platform The observed path grammar; the host platform by default.
 * @evidence contracts/common.md#principled-implementation Both named and physical roots can place an input inside the same project; an empty relative path explicitly identifies the root itself.
 * @evidence contracts/common.md#clear-and-simple-design At most two existing lexical-containment checks produce the relative spelling, without resolving every input again.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Link-root aliases are not repaired with prefix substitution or a platform-specific temporary-directory exception.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain two-root containment, undefined, and the root's empty-string representation.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral containment uses native resolve/relative and root boundaries under both observed spellings, preserving cross-drive rejection without a fixed platform path policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Resolves the input once, then tries at most two captured roots using
 *   lexical containment. Cost scales with input and root spelling lengths;
 *   no native metadata or recursive directory observation is repeated.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function relativeToProject(
  file: string,
  project: TtscProjectSpellings,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const absolute = pathApi.resolve(file);
  for (const root of project.physical === project.spelling
    ? [project.spelling]
    : [project.spelling, project.physical]) {
    if (pathIsWithin(absolute, root, platform))
      return pathApi.relative(root, absolute);
  }
  return undefined;
}
