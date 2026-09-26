import { processPluginBuildEnvironment } from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { pluginSourceHolds } from "../inputs/pluginSourceHolds";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Whether every plugin source directory of a generation still holds the state
 * its binary was built from, its files and the environment a build there runs
 * in (samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * A directory whose tracker heard nothing below it has unchanged files, and is
 * skipped while the environment it was last proven under is still this
 * process's reading (`processPluginBuildEnvironment`), which holds only while
 * the Go tool, its environment file, and the C toolchain it names hold: the
 * tracker watches the sources, not the toolchain outside them
 * (samchon/ttsc#1516). Any other is proven by ttsc's rule
 * (`pluginSourceHolds`), since no one path's metadata stands for the files
 * below it. The proof lists the directory as the plugin build lists it, which a
 * delivery pays only after an event below the directory, a changed environment,
 * or where no tracker watches it or its watch cannot vouch for it, and reads
 * the files' bytes again only when their metadata moved
 * (`pluginSourceFilesDigest`).
 *
 * @param cached The generation being validated.
 * @param validation Its universal-input manifest.
 */
export function matchesUniversalHostInputTrees(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  for (const [directory, digest] of validation.trees) {
    if (
      trackerProvesInputUnchanged(cached.hostInputMutationTracker, directory) &&
      validation.treeEnvironments?.get(directory) ===
        processPluginBuildEnvironment(directory)
    )
      continue;
    if (!pluginSourceHolds(directory, digest, resultFilesystem(cached.result)))
      return false;
    (validation.treeEnvironments ??= new Map()).set(
      directory,
      processPluginBuildEnvironment(directory),
    );
  }
  return true;
}
