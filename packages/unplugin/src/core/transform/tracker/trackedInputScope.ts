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
