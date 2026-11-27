import { pluginSourceDigest } from "ttsc/plugin-source";

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
 * @evidence contracts/common.md#principled-implementation The native target and shared source digest distinguish directory appearance, retargeting, and changes to selected files. No Go environment or successful compiler state is inferred.
 * @evidence contracts/common.md#clear-and-simple-design One source observation serves failed delivery, the live observer and detached records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Directory availability is checked independently because the build's source digest treats a missing directory like an empty one.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains unavailable targets and unreadable sources, with a blank line before the tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native stat and realpath follow directory links under the supplied filesystem view. The shared source selector reads native files, so that view must describe the same paths.
 * @evidence contracts/performance.md#efficient-algorithms Unavailable targets cost one stat attempt or a stat and realpath. Available directories additionally pay the shared sorted source enumeration and selected byte reads, plus hashing the target and source digest text.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each comparison observes current source state; the recovery watcher decides when to compare.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The digest and native observations are call-local and open no retained handles.
 */
export function captureRecoveryTreeDigest(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
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
    source = pluginSourceDigest(file);
  } catch {
    // Repairing an unreadable source changes the recovery state.
  }
  return hashText(JSON.stringify([target, source]));
}
