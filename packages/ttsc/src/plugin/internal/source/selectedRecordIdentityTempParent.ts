import fs from "node:fs";
import path from "node:path";

import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Return an existing ordinary identities directory below a selected record
 * root, or leave temporary placement to the caller's system default.
 *
 * The returned physical path is a direct child of the selected root. The caller
 * supplies the consumer roots. Inside those roots, only a physical
 * node_modules/.cache/ttsc store may host evaluator files. The caller still
 * uses createCanonicalTempDirectory to verify its own allocation; these
 * observations do not hold the namespace against later mutation. A non-UTF-8
 * parent leaves temporary placement to the system selector.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath and link-preserving stat admit only a present ordinary identities directory whose physical parent is the selected root; an unproved path supplies no alternate temporary parent.
 * @evidence contracts/common.md#clear-and-simple-design One small selector shares the same record-root placement rule between descriptor evaluation and child output capture; allocation and cleanup remain with their respective owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function neither creates a cache root nor accepts a linked identities entry as evidence of an owned child; failed observations retain the ordinary caller path.
 * @evidence contracts/common.md#meaningful-documentation The comment states the selected-root premise, returned physical path and remaining namespace race without claiming held-directory protection.
 * @evidence contracts/portability.md#os-neutral-implementation Native identity expands links and junctions before checking containment. Only roots and children with lossless string paths qualify. A POSIX raw consumer root cannot contain a string-addressable child.
 * @evidence contracts/performance.md#efficient-algorithms A fixed number of native observations selects the managed parent. Other candidates add one realpath per consumer root, without enumeration. Lookup depth and path length affect the cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A record root or identities entry can be replaced between calls, so each allocation needs current observations instead of a remembered parent.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selector acquires no handle or directory and retains no state; its returned path is caller-owned text.
 */
export function selectedRecordIdentityTempParent(
  recordRoot: string | undefined,
  projectRoots: readonly string[] = [],
): string | undefined {
  if (recordRoot === undefined || !path.isAbsolute(recordRoot))
    return undefined;
  try {
    const physicalRoot = RuntimeFilesystem.realpathWitness(recordRoot);
    if (
      physicalRoot.includes("\0") ||
      !fs.lstatSync(physicalRoot).isDirectory()
    )
      return undefined;
    const identities = path.join(physicalRoot, "identities");
    const identityStats = fs.lstatSync(identities);
    if (!identityStats.isDirectory() || identityStats.isSymbolicLink())
      return undefined;
    const physicalIdentities = RuntimeFilesystem.realpathWitness(identities);
    if (
      physicalIdentities.includes("\0") ||
      path.dirname(physicalIdentities) !== physicalRoot
    )
      return undefined;
    const managed =
      path.basename(physicalRoot) === "ttsc" &&
      path.basename(path.dirname(physicalRoot)) === ".cache" &&
      path.basename(path.dirname(path.dirname(physicalRoot))) ===
        "node_modules";
    if (!managed) {
      for (const root of projectRoots) {
        const physicalProject = RuntimeFilesystem.realpathWitness(root);
        if (physicalProject.includes("\0")) continue;
        const relative = path.relative(physicalProject, physicalIdentities);
        if (
          relative === "" ||
          (!path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`))
        )
          return undefined;
      }
    }
    return physicalIdentities;
  } catch {
    return undefined;
  }
}
