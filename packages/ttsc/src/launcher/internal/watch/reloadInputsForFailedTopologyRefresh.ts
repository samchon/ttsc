import fs from "node:fs";
import path from "node:path";

import type { ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { WatchPaths } from "./WatchPaths";

/**
 * The reload inputs to keep watching after a topology refresh failed: the path
 * that triggered the refresh and every declared reload file that is currently
 * missing, so recreating any of them retries the refresh.
 *
 * The supplied identity transaction shares native case observations with the
 * failed reconciliation; omitting it starts fresh observations for this pass.
 *
 * @evidence contracts/common.md#principled-implementation The triggering reload input and currently absent reload files remain observable recovery inputs even when normal topology construction failed.
 * @evidence contracts/common.md#clear-and-simple-design One keyed collection deduplicates selected recovery paths before deterministic sorting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure does not fabricate a healthy compiler population or drop missing selection inputs.
 * @evidence contracts/common.md#meaningful-documentation Native prose specifies the recovery population and recreation purpose following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and existence queries preserve host grammar; measured component keys retain sensitive and unknown names, while conservative event matching can retry an unproven case alias without merging stored reload members.
 * @evidence contracts/performance.md#efficient-algorithms N reload members each require depth-dependent key and optional routing queries; R selected recovery paths are sorted in O(R log R), with one indexed deduplication population and no descendant corpus scan.
 * @evidence contracts/performance.md#reuse-equivalent-work One supplied or invocation-local transaction shares repeated native case observations across recovery keys and event matching; later recovery work obtains fresh native state.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The source iterable and transaction are borrowed; the returned local recovery population acquires no watcher or retained historical cache.
 */
export function reloadInputsForFailedTopologyRefresh(
  reloadFiles: Iterable<string>,
  changed?: string,
  identities: ProjectInputPathIdentityContext = createProjectInputPathIdentityContext(
    {
      throwOnRealpathError: false,
    },
  ),
): string[] {
  const reloads = new Map<string, string>();
  for (const location of reloadFiles) {
    const resolved = path.resolve(location);
    const key = WatchPaths.pathKey(resolved, identities);
    if (
      (changed !== undefined && identities.lexicalMatches(changed, resolved)) ||
      fs.existsSync(resolved) === false
    ) {
      reloads.set(key, resolved);
    }
  }
  return [...reloads.values()].sort();
}
