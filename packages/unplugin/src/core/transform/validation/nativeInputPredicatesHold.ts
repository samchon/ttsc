import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { nativeInputPredicateMatches } from "../inputs/nativeInputPredicateMatches";

/**
 * Validate every generation-owned native config predicate before cache reuse.
 * This check also applies when notification/epoch shortcuts admit other inputs.
 * A generation with no native predicates requires no native replay context;
 * existing non-native proof owners still perform their own validation.
 *
 * @evidence contracts/common.md#principled-implementation Every recorded native predicate must match through the generation's original filesystem view. An empty native predicate population contributes no native constraint, without admitting other proof domains or converting an exception into reuse.
 * @evidence contracts/common.md#clear-and-simple-design One gate is shared by source, complete-snapshot and universal-input admission; the typed replay owns encodings and native errors.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata and notification shortcuts cannot omit typed config predicates or repair an unstable producer witness.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies generation ownership and the admission shortcuts that must retain this gate.
 * @evidence contracts/portability.md#os-neutral-implementation Relative names are resolved against the recorded project with the filesystem view's path dialect; native identity and encoding belong to the replay operation.
 * @evidence contracts/performance.md#efficient-algorithms The initial observation scan detects whether native replay is required without resolving a root or performing filesystem queries. Nonempty populations add a second linear traversal plus native replay and path-byte costs, stopping at the first refusal; empty and legacy-only populations require no replay context.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This admission gate stores no separate cache and checks the recorded generation supplied by its caller.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Per-call enumeration owns no handle or watcher; the cached envelope owns retained predicates.
 */
export function nativeInputPredicatesHold(
  cached: TtscCachedProjectTransform,
): boolean {
  if (cached.result.type === "exception") return false;
  const observations = cached.result.graph?.inputObservations ?? {};
  if (
    !Object.values(observations).some(
      (observation) => (observation.nativePredicates?.length ?? 0) !== 0,
    )
  )
    return true;
  const filesystem = resultFilesystem(cached.result);
  const identities = envelopeDerivation(cached).identityContext;
  for (const [name, observation] of Object.entries(observations)) {
    if ((observation.nativePredicates?.length ?? 0) === 0) continue;
    const file = (
      (filesystem.platform ?? process.platform) === "win32"
        ? path.win32
        : path.posix
    ).resolve(cached.projectRoot, name);
    for (const predicate of observation.nativePredicates ?? [])
      if (!nativeInputPredicateMatches(file, predicate, filesystem, identities))
        return false;
  }
  return true;
}
