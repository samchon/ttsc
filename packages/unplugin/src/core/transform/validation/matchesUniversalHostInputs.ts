import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { matchesUniversalHostInputEntries } from "./matchesUniversalHostInputEntries";
import { matchesUniversalHostInputProbes } from "./matchesUniversalHostInputProbes";
import { matchesUniversalHostInputTrees } from "./matchesUniversalHostInputTrees";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Validate universal descriptor/config inputs without re-reading them for every
 * module. Existing paths use the same nanosecond metadata manifest that guards
 * GOROOT identity memoization; missing probes are grouped by the nearest
 * existing directory and checked through one exact membership listing.
 *
 * While the tracker proves every input the manifest covers unchanged, nothing
 * is read. Otherwise each input is proven on its own: an entry or a plugin
 * source its tracker proves is skipped, and the rest are read. One input a
 * watch cannot prove, a plugin source outside the project on macOS, whose
 * stream no probe proves delivered (samchon/ttsc#1453), used to send every
 * universal input back to the disk on every delivery.
 */
export function matchesUniversalHostInputs(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  let notificationsProveAll = true;
  for (const input of validation.covered) {
    if (!trackerProvesInputUnchanged(cached.hostInputMutationTracker, input)) {
      notificationsProveAll = false;
      break;
    }
  }
  if (notificationsProveAll) return true;
  return (
    matchesUniversalHostInputEntries(cached, validation) &&
    matchesUniversalHostInputProbes(cached, validation) &&
    matchesUniversalHostInputTrees(cached, validation)
  );
}
