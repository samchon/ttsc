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
 * A directory whose tracker heard nothing below it is proven by that silence;
 * any other is proven by ttsc's rule (`pluginSourceHolds`), since no one path's
 * metadata stands for the files below it. The proof lists the directory as the
 * plugin build lists it, which a delivery pays only after an event below the
 * directory, or where no tracker watches it or its watch cannot vouch for it,
 * and reads the files' bytes again only when their metadata moved
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
    if (trackerProvesInputUnchanged(cached.hostInputMutationTracker, directory))
      continue;
    if (!pluginSourceHolds(directory, digest, resultFilesystem(cached.result)))
      return false;
  }
  return true;
}
