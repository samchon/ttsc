import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./ProcessOwnedDirectory";

/**
 * What `ttsc clean` removes of a cache root's ttsx runtime directory
 * (samchon/ttsc#1579).
 *
 * The runtime directory holds one directory per prepared run, owned by the
 * processes of that run (`ProcessOwnedDirectory`). A run still in progress
 * keeps its directory, which clean reports instead of removing. Every other
 * entry goes: one whose owners are all provably gone, and one without an owner
 * record, which a run records the moment it creates its directory, so only an
 * earlier version's run leaves one. When nothing is kept, the whole runtime
 * directory goes.
 *
 * Call while holding `withRuntimeDirectoryLock` for this runtime root, so a
 * new run cannot appear between inspection and removal.
 *
 * @param cacheRoot The resolved cache root.
 * @returns The directories to remove, and the run directories kept.
 */
export function resolveRuntimeCleanTargets(cacheRoot: string): {
  kept: string[];
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
  try {
    entries = fs.readdirSync(runs);
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
    const directory = path.join(runs, entry);
    const ownership = ProcessOwnedDirectory.ownership(directory);
    if (ownership === "live" || ownership === "unknown")
      kept.push(directory);
    else removable.push(directory);
  }
  return {
    kept,
    targets: kept.length === 0 ? [runtime] : removable,
  };
}
