import { realpathHostInput } from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Read the physical identity selected by a host-input path. The native resolver
 * shares the compiler's encoding for POSIX byte paths. A custom resolver
 * supplies its own identity. Resolution failure returns null.
 *
 * @evidence contracts/common.md#principled-implementation Successful physical resolution and failure remain distinct through string and null without applying the compiler's lexical fallback.
 * @evidence contracts/common.md#clear-and-simple-design The compiler helper owns native witness encoding, the supplied resolver owns custom observations, and callers own identity comparison.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed native resolution is not replaced with guessed lexical identity or a known-input target.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the native witness, custom identity and unresolved semantics.
 * @evidence contracts/portability.md#os-neutral-implementation Native observations use the compiler's byte-preserving resolver. Custom views keep their realpath capability and spelling policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call returns before the function does; no handle is retained.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The native helper checks missing paths by lstat and resolves present paths
 *   with byte preservation. The custom view supplies one resolver call. Both
 *   costs depend on the path components and native link targets.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This observes one current target. Identity contexts and enclosing generation
 *   validators own any sharing and its observation lifetime.
 */
export function hostInputRealpath(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  if (filesystem.realpath === DEFAULT_FILESYSTEM_OPERATIONS.realpath)
    return realpathHostInput(file);
  try {
    return filesystem.realpath(file);
  } catch {
    return null;
  }
}
