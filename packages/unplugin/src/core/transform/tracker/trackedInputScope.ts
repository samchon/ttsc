import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscTrackedInputScope } from "./TtscTrackedInputScope";

/**
 * Derive a tracked input's event scope from what the compiler observed about
 * it.
 *
 * The compiler's own predicate is the authority: a directory listing needs its
 * direct children, a read needs the content, and the remaining predicates need
 * only the path's presence. An input the compiler left no observation for is
 * classified from the filesystem: an existing file by its content, and a
 * directory or a missing path by the widest scope, since nothing says which
 * part of it was read.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Recorded compiler predicates outrank inferred file kind. Missing or
 *   unclassified inputs receive subtree scope so uncertainty cannot prove reuse.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Ordered predicate checks precede one fallback stat; plugin-specific tree
 *   selection remains with trackedInputScopes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failed stat widens observation instead of inventing a safe absence;
 *   classification uses recorded operations rather than filename exceptions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain observation authority and fallback uncertainty,
 *   following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral classification uses the supplied filesystem's stat and compiler
 *   observations; no platform-wide case or separator assumption is introduced.
 */
export function trackedInputScope(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation | undefined,
  filesystem: TtscTransformFilesystemOperations,
): TtscTrackedInputScope {
  if (observation !== undefined) {
    if (observation.accessibleEntries !== undefined) return "children";
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
