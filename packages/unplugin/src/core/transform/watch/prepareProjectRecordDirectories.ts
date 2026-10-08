import fs from "node:fs";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "../../bridge/PROJECT_RECORD_DIRECTORY";
import type { TtscTransformHooks } from "./TtscTransformHooks";

/**
 * Acquire the host's record directories before a generation observes inputs.
 *
 * A record is handed over after capture. Creating its parent then would change
 * a native directory witness that includes the host root. Both accepted storage
 * locations are acquired now, including a fallback the later writer may need.
 * This creates no record and proves no writability. Failed acquisition remains
 * subject to the existing writer's fallback, warning and watching-error
 * policy.
 *
 * @param project The current host's optional record registration owner.
 * @evidence contracts/common.md#principled-implementation Owned parent acquisition precedes generation observation; actual record writes and refusals retain their existing owner.
 * @evidence contracts/common.md#clear-and-simple-design One common transform boundary prepares both accepted record locations without changing adapter path conventions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No input witness is excluded and no failed mkdir is treated as a successful record handoff.
 * @evidence contracts/common.md#meaningful-documentation Acquisition, later fallback and the absence of a writability promise are separated explicitly.
 * @evidence contracts/portability.md#os-neutral-implementation Native joins and recursive mkdir retain each host's supplied path and platform errors.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle, timer, task or cache is retained; persistent directories belong to the existing record lifetime.
 * @evidence contracts/performance.md#efficient-algorithms At most two recursive mkdir calls precede selection, with native ancestor traversal and path text allocation; no directory listing, record serialization or compiler invocation is added.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Acquisition is attempted per eligible delivery so deletion or repaired permissions are not hidden by a permanent success cache.
 */
export function prepareProjectRecordDirectories(
  project: TtscTransformHooks["project"],
): void {
  if (project === undefined) return;
  const directories = [
    project.toolDirectory,
    ...(project.fallbackToolDirectory === undefined
      ? []
      : [project.fallbackToolDirectory]),
  ];
  for (const directory of directories) {
    try {
      fs.mkdirSync(path.join(directory, PROJECT_RECORD_DIRECTORY), {
        recursive: true,
      });
    } catch {
      // Preparation cannot decide whether the later record can be written.
      // The existing writer owns its actual error and fallback semantics.
    }
  }
}
