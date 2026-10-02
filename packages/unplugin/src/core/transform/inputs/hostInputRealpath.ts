import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Read the physical spelling selected by a host-input path. Resolution failure
 * returns null; successful resolver spelling is returned unchanged so callers
 * can apply their filesystem identity policy separately.
 *
 * @evidence contracts/common.md#principled-implementation Successful physical resolution and failure remain distinct through string and null without applying the compiler's lexical fallback.
 * @evidence contracts/common.md#clear-and-simple-design A single resolver call exposes target observation while normalization and identity comparison remain caller responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed native resolution is not replaced with guessed lexical identity or a known-input target.
 * @evidence contracts/common.md#meaningful-documentation Native prose states failure and unchanged-spelling semantics, using separated prose and tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral target observation delegates to the supplied realpath capability, retaining native aliases and spelling without platform-wide case folding.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call returns before the function does; no handle is retained.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One realpath call.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work It reads the target now by design, so nothing is shared.
 */
export function hostInputRealpath(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  try {
    return filesystem.realpath(file);
  } catch {
    return null;
  }
}
