import { MANAGED_PROJECT_RECORDS } from "../../bridge/MANAGED_PROJECT_RECORDS";
import type { TtscTransformHooks } from "./TtscTransformHooks";

/**
 * Enumerate a host's record directories in write order with the storage policy
 * of each candidate.
 *
 * @evidence contracts/common.md#principled-implementation The adapter marks the generated candidate by its role in the hook.
 * @evidence contracts/common.md#clear-and-simple-design Preparation and handoff share the same candidate order and policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A caller's matching path spelling does not establish managed provenance.
 * @evidence contracts/common.md#meaningful-documentation The comment explains the order and per-candidate policy.
 * @evidence contracts/portability.md#os-neutral-implementation Both candidates retain their supplied native spelling.
 * @evidence contracts/performance.md#efficient-algorithms Each call creates at most two candidate objects.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The short list is derived from the current hook.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the returned list.
 */
export function projectRecordDirectories(
  project: NonNullable<TtscTransformHooks["project"]>,
): { directory: string; privateStorage: boolean }[] {
  const directories = [
    {
      directory: project.toolDirectory,
      privateStorage: project[MANAGED_PROJECT_RECORDS] === "toolDirectory",
    },
  ];
  if (project.fallbackToolDirectory !== undefined)
    directories.push({
      directory: project.fallbackToolDirectory,
      privateStorage:
        project[MANAGED_PROJECT_RECORDS] === "fallbackToolDirectory",
    });
  return directories;
}
