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
