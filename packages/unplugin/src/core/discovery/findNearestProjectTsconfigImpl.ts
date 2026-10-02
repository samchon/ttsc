import path from "node:path";

import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";
import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";

/**
 * Walk ancestor directories, optionally retaining every consulted predicate.
 *
 * Failed stat observations cannot select a config. Reaching the volume root
 * without a regular candidate returns undefined.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Every iteration probes one ancestor's tsconfig.json; dirname moves toward
 *   a fixed root, and the first proven regular file wins.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One loop owns candidate choice and optional recording, so both discovery
 *   entry points share absence and ordering semantics.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Explicit platform selects win32 or posix path syntax; otherwise Node uses
 *   host-native paths. The observed stat capability decides regular-file kind;
 *   dirname terminates at that native root without shell invocation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failed observations remain false predicates, not fabricated config paths;
 *   the filesystem parameter supplies native observations without patching.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains optional recording, failure handling and root termination;
 *   separate paragraphs give the purpose and the nonobvious boundary.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Walks the parent chain once with one stat per level and stops at the
 *   filesystem root.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function findNearestProjectTsconfigImpl(
  startDirectory: string,
  filesystem: TtscProjectDiscoveryFilesystem,
  candidates?: TtscProjectTsconfigCandidate[],
): string | undefined {
  const paths =
    filesystem.platform === undefined
      ? path
      : filesystem.platform === "win32"
        ? path.win32
        : path.posix;
  let current = paths.resolve(startDirectory);
  while (true) {
    const candidate = paths.join(current, "tsconfig.json");
    let fileExists = false;
    try {
      fileExists = filesystem.stat(candidate).isFile();
    } catch {
      // An implicit candidate is selectable only when its file kind is proven.
    }
    candidates?.push({ file: candidate, fileExists });
    if (fileExists) {
      return candidate;
    }
    const parent = paths.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
