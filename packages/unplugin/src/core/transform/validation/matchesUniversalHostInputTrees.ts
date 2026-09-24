import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
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
 * metadata stands for the files below it. The proof reads the directory as the
 * plugin build reads it, which a delivery pays only after an event below the
 * directory, or where no tracker watches it at all.
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
    if (!pluginSourceHolds(directory, digest)) return false;
  }
  return true;
}
