import {
  pluginSourceDigest,
  provenPluginSourceDigest,
} from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";

/**
 * Observe the directory and the sources a failed compiler can recover from.
 *
 * A missing or non-directory target has no digest. A directory whose source
 * cannot be read still records its physical target, so making its source
 * readable changes the recovery observation.
 *
 * Capture before compilation can use the compiler's content store under its
 * effective environment. The store owns its clock probes and reuses a digest
 * only while its source metadata qualifies. A cold or unproven reading requires
 * the selected source bytes.
 *
 * @evidence contracts/common.md#principled-implementation The native target and shared source digest distinguish directory appearance, retargeting, and changes to selected files. No Go environment or successful compiler state is inferred.
 * @evidence contracts/common.md#clear-and-simple-design One source observation serves failed delivery, the live observer and detached records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Directory availability is checked independently because the build's source digest treats a missing directory like an empty one.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains unavailable targets and unreadable sources, with a blank line before the tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native stat and realpath follow directory links under the supplied filesystem view. The shared source selector reads native files, so that view must describe the same paths.
 * @evidence contracts/performance.md#efficient-algorithms Unavailable targets cost one stat attempt or a stat and realpath. Available directories pay for the source selector. With a store this includes opening its cache and probing source metadata, with content read on a miss. Direct replay reads selected bytes. Both paths hash the target and source digest text.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller's exact project and effective environment select the existing compiler content store. Store-owned separable source signatures qualify a warm digest; other calls read current bytes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The digest and filesystem observations are call-local. The existing content store releases its clock probes and owns the retention of persisted identities.
 */
export function captureRecoveryTreeDigest(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  compiler?: { projectRoot: string; environment: NodeJS.ProcessEnv },
): string | null {
  let target: string;
  try {
    if (!filesystem.stat(file).isDirectory()) return null;
    target = filesystem.realpath(file);
  } catch {
    return null;
  }
  let source: string | null = null;
  try {
    source =
      compiler === undefined
        ? pluginSourceDigest(file)
        : provenPluginSourceDigest(
            file,
            compiler.projectRoot,
            compiler.environment,
          );
  } catch {
    // Repairing an unreadable source changes the recovery state.
  }
  return hashText(JSON.stringify([target, source]));
}
