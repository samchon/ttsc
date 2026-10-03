import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./ProcessOwnedDirectory";

/**
 * What `ttsc clean` removes of a cache root's ttsx runtime directory.
 *
 * The runtime directory holds one directory per prepared run, owned by the
 * processes of that run (`ProcessOwnedDirectory`). A run still in progress
 * keeps its directory, which clean reports instead of removing. Every other
 * entry whose owners are all provably gone goes. A run without an owner record
 * may still belong to an older executable that does not use the lock, so it is
 * kept alongside live and unreadable owners. When nothing is kept, the whole
 * runtime directory goes.
 *
 * Call while holding `withRuntimeDirectoryLock` for this runtime root, so a new
 * cooperating run cannot appear between inspection and removal. Physical
 * spelling and the cooperative lock do not pin native objects or authenticate
 * owner records against independent mutation.
 *
 * @param cacheRoot The resolved cache root.
 *
 * @returns The directories to remove, and the run directories kept.
 *
 * @evidence contracts/common.md#principled-implementation Under the root lock, only provably abandoned owner sets become removal targets; live, unknown and unowned runs are preserved, and the physical run index pins external targets before unlinking an empty runtime tree.
 * @evidence contracts/common.md#clear-and-simple-design The function plans targets and kept runs without performing deletion, separating ownership classification from the clean command's removal effects.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No unreadable-owner or legacy unowned run is treated as abandoned merely to make clean remove more directories; physical target selection corrects alias identity rather than compensating with lexical retries.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain kept ownership, the required lock and whole-tree removal, with parameters and return fields documented following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath pins a linked run index; path joins retain host spelling and ProcessOwnedDirectory uses conservative local process evidence instead of OS-name case or signal assumptions.
 * @evidence contracts/performance.md#efficient-algorithms One native realpath/listing and one delegated ownership scan per run process E entries plus owner filenames/JSON bytes, host labels and native process observations. Native path text and IO latency are additional costs; returned target/kept strings scale with listed entries and their path bytes, not only entry count.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Ownership can change between clean invocations; the caller's held lock validates only this plan, not a reusable historical plan.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call returns a removal plan and closes synchronous reads; the clean command owns deletion, and live processes retain their own run resources.
 */
export function resolveRuntimeCleanTargets(cacheRoot: string): {
  /** Run directories protected by live, unknown or absent ownership evidence. */
  kept: string[];

  /** Pinned abandoned targets, followed by the runtime tree when none is kept. */
  targets: string[];
} {
  const runtime = path.join(
    cacheRoot,
    SourceBuildCacheLayout.RUNTIME_CACHE_DIRNAME,
  );
  const runs = path.join(
    runtime,
    SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME,
  );
  let entries: string[];
  let physicalRuns: string;
  try {
    // The run index can be reached through a junction. Record its current
    // physical spelling so a later index retarget alone does not redirect
    // planned children; this is not a pinned native object handle.
    physicalRuns = fs.realpathSync.native(runs);
    entries = fs.readdirSync(physicalRuns);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kept: [], targets: [runtime] };
    }
    throw error;
  }
  const kept: string[] = [];
  const removable: string[] = [];
  for (const entry of entries) {
    const directory = path.join(physicalRuns, entry);
    const ownership = ProcessOwnedDirectory.ownership(directory);
    if (ownership !== "abandoned") kept.push(directory);
    else removable.push(directory);
  }
  return {
    kept,
    // Remove pinned external run targets before removing a runtime link. A
    // whole-tree removal alone would only unlink the index and strand those
    // abandoned generations in its old physical target.
    targets: kept.length === 0 ? [...removable, runtime] : removable,
  };
}
