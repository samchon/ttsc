import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscTrackedInputScope } from "./TtscTrackedInputScope";

/**
 * Derive a tracked input's event scope from what the compiler observed about
 * it.
 *
 * A successful read needs content, while a nonempty or directory-qualified
 * listing needs direct children. Empty listings do not establish directory
 * kind: the supplied filesystem distinguishes files from directories, and
 * failed classification retains subtree uncertainty. Remaining predicates need
 * only path presence. An input the compiler left no observation for is
 * classified from the filesystem: an existing file by its content, and a
 * directory or a missing path by the widest scope, since nothing says which
 * part of it was read.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Successful reads retain content even beside empty listings; directory
 *   listings retain children despite failed reads. Empty unknown listings use
 *   supplied metadata, whose failure preserves subtree uncertainty.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Compatible predicate checks precede at most one native stat; plugin-specific
 *   tree selection remains with trackedInputScopes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failed stat widens observation instead of inventing a safe absence;
 *   classification uses recorded operations rather than filename exceptions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain observation authority and fallback uncertainty,
 *   following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral classification uses the supplied filesystem's stat and compiler
 *   observations; no platform-wide case or separator assumption is introduced.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The stat returns before the function does; no handle is retained.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed predicate and array-length checks precede at most one supplied stat;
 *   its native path-resolution cost is not assumed constant.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This classification derives one current input dependency; generation graph
 *   derivation and native watch sharing belong to the enclosing constructors.
 */
export function trackedInputScope(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation | undefined,
  filesystem: TtscTransformFilesystemOperations,
): TtscTrackedInputScope {
  if (observation !== undefined) {
    if (observation.readFile?.ok === true) return "content";
    if (observation.accessibleEntries !== undefined) {
      if (
        observation.accessibleEntries.directories.length !== 0 ||
        observation.accessibleEntries.files.length !== 0 ||
        observation.stat === "directory" ||
        observation.directoryExists === true
      ) {
        return "children";
      }
      try {
        return filesystem.stat(file).isFile() ? "content" : "children";
      } catch {
        return "subtree";
      }
    }
    if (observation.readFile !== undefined) return "content";
    if (
      observation.fileExists !== undefined ||
      observation.directoryExists !== undefined ||
      observation.stat !== undefined ||
      observation.realpath !== undefined
    ) {
      return "presence";
    }
  }
  try {
    return filesystem.stat(file).isFile() ? "content" : "subtree";
  } catch {
    return "subtree";
  }
}
