import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { nativeInputPredicateMatches } from "../inputs/nativeInputPredicateMatches";
import type { TtscGenerationProof } from "./TtscGenerationProof";

// Weakly owned by immutable observation membership, never by current verdict.
// Keeping this separate from native path derivation also preserves the empty
// predicate gate's promise to perform no native identity observations.
const predicateInputs = new WeakMap<
  object,
  Array<[string, ITtscCompilerTransformation.IInputObservation]>
>();

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
 * @evidence contracts/performance.md#efficient-algorithms Immutable observation membership is indexed once, including an empty population. Each new synchronous admission replays only indexed native predicates and stops at the first refusal; nested validators share its verdict without another scan or native query. Empty populations require no native replay context.
 * @evidence contracts/performance.md#reuse-equivalent-work A weak observation index shares immutable membership. Current verdicts belong only to an exact-owner synchronous transaction, never the next delivery or an await.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The weak index follows immutable observation lifetime; synchronous verdicts and native queries acquire no handle or history.
 */
export function nativeInputPredicatesHold(
  cached: TtscCachedProjectTransform,
  proof?: TtscGenerationProof.Transaction,
): boolean {
  if (cached.result.type === "exception") return false;
  if (proof?.cached === cached && proof.nativePredicates !== undefined)
    return proof.nativePredicates;
  // Membership is immutable generation data. A positive native verdict is
  // current observation: share it only with nested synchronous validators,
  // never the next delivery, pass or await (#1714).
  const finish = (matches: boolean): boolean => {
    if (proof?.cached === cached) proof.nativePredicates = matches;
    return matches;
  };
  const observations = cached.result.graph?.inputObservations;
  if (observations === undefined) return finish(true);
  let inputs = predicateInputs.get(observations);
  if (inputs === undefined) {
    inputs = Object.entries(observations).filter(
      ([, observation]) => (observation.nativePredicates?.length ?? 0) !== 0,
    );
    predicateInputs.set(observations, inputs);
  }
  if (inputs.length === 0) return finish(true);
  const filesystem = resultFilesystem(cached.result);
  const identities = envelopeDerivation(cached).identityContext;
  for (const [name, observation] of inputs) {
    const file = (
      (filesystem.platform ?? process.platform) === "win32"
        ? path.win32
        : path.posix
    ).resolve(cached.projectRoot, name);
    for (const predicate of observation.nativePredicates ?? [])
      if (!nativeInputPredicateMatches(file, predicate, filesystem, identities))
        return finish(false);
  }
  return finish(true);
}
