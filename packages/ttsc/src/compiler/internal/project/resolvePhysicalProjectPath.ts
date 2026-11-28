import fs from "node:fs";

import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Resolve a project path before a reader uses its physical spelling. An
 * unavailable lookup retains the selected spelling. A POSIX physical path
 * outside UTF-8 cannot supply a string address for the compiler or VFS.
 *
 * @evidence contracts/common.md#principled-implementation The native path either has a lossless string spelling, is unavailable and retains its lexical name, or proves an unsupported byte address and stops before the reader opens it.
 * @evidence contracts/common.md#clear-and-simple-design Selection, root ownership and config inheritance share one physical path policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A successful byte lookup cannot authorize opening the UTF-8 lookalike of another file.
 * @evidence contracts/common.md#meaningful-documentation Identifies the physical-path requirement and the difference between unavailable lookup and a known byte path.
 * @evidence contracts/portability.md#os-neutral-implementation The existing Windows realpath preserves alias behavior. POSIX native realpath uses byte-level witnesses and qualifies their string spelling before returning an address.
 * @evidence contracts/performance.md#efficient-algorithms One filesystem realpath attempt plus POSIX path encoding, with no directory listing or input read.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable aliases require a fresh native lookup.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The helper retains only call-local path text and returns no handle.
 */
export function resolvePhysicalProjectPath(
  location: string,
  owner: "selected config" | "extended config" | "project root",
): string {
  let physical: string;
  try {
    physical =
      process.platform === "win32"
        ? fs.realpathSync(location)
        : RuntimeFilesystem.realpathWitness(location);
  } catch {
    return location;
  }
  if (physical.includes("\0"))
    throw Object.assign(
      new Error(`ttsc: ${owner} has no UTF-8 physical path: ${location}`),
      {
        code: "TTSC_UNREPRESENTABLE_PROJECT_PATH",
      },
    );
  return physical;
}
