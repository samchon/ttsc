import type { ITtscCompilerTransformation } from "ttsc";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_RESULT_FILESYSTEM } from "./TRANSFORM_RESULT_FILESYSTEM";

/**
 * Return the filesystem view one compiler result is validated against.
 *
 * A generation must be re-proven through the same view it was captured through:
 * an embedder that observes another filesystem supplies its own operations, and
 * mixing them with host reads would compare state from two different
 * filesystems. Results captured without a registered view fall back to the host
 * filesystem.
 */
export function resultFilesystem(
  result: ITtscCompilerTransformation,
): TtscTransformFilesystemOperations {
  return (
    TRANSFORM_RESULT_FILESYSTEM.get(result) ?? DEFAULT_FILESYSTEM_OPERATIONS
  );
}
