import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { pluginSourceState } from "../inputs/pluginSourceState";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Whether every plugin source directory of a generation still holds the digest
 * its binary was built from (samchon/ttsc#1487).
 *
 * A directory whose tracker heard nothing below it is proven by that silence;
 * any other is proven by recomputing its digest, since no one path's metadata
 * stands for the files below it. The recompute reads the directory as the
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
    if (pluginSourceState(directory) !== digest) return false;
  }
  return true;
}
