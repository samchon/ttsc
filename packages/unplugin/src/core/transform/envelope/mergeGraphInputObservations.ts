import type { ITtscCompilerTransformation } from "ttsc";

import { graphInputObservationCompatible } from "./graphInputObservationCompatible";

/**
 * Join normalized duplicate lexical keys only when repeated predicates agree.
 *
 * Normalization fixes object member order before structural comparison. List
 * order remains part of the recorded directory observation, and the merged
 * record must also satisfy cross-predicate compatibility. Undefined marks a
 * conflict; it does not mean that the path was absent.
 *
 * @evidence contracts/common.md#principled-implementation Repeated compiler predicates must serialize identically; native predicates retain distinct kind/scope entries only while same-kind witnesses agree, after which cross-predicate compatibility rejects contradictory combinations. Independent predicate records merge without replacing either input.
 * @evidence contracts/common.md#clear-and-simple-design This operation owns duplicate observation union; normalization, permanent conflict indexing, legacy projection and native replay remain separate boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Conflicting predicate or listing values return no merged proof; a later predicate cannot silently repair the earlier contradictory observation.
 * @evidence contracts/common.md#meaningful-documentation Native prose specifies normalized inputs, significant listing order and conflict versus absence, without claiming live filesystem agreement.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares normalized recorded predicate values in memory; native path grammar, identity resolution and live observation belong to the producer and validator.
 * @evidence contracts/performance.md#efficient-algorithms Six compiler predicates are compared, followed by a native kind/scope union with pairwise same-kind consistency checks and deterministic sorting. The native union costs quadratic predicate comparisons and linear retained records. Work and temporary strings follow repeated listing and path payload bytes, not just predicate count; no native input is read.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Combines this duplicate pair without storing a memo or certifying reuse of native observations across captures.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a shallow merged record borrowing nested predicate values or no result; the envelope index owns retained lists and conflicts, and this operation acquires no resource or historical state.
 */
export function mergeGraphInputObservations(
  left: ITtscCompilerTransformation.IInputObservation,
  right: ITtscCompilerTransformation.IInputObservation,
): ITtscCompilerTransformation.IInputObservation | undefined {
  for (const property of [
    "accessibleEntries",
    "directoryExists",
    "fileExists",
    "readFile",
    "realpath",
    "stat",
  ] as const) {
    if (
      left[property] !== undefined &&
      right[property] !== undefined &&
      JSON.stringify(left[property]) !== JSON.stringify(right[property])
    ) {
      return undefined;
    }
  }
  const native = new Map<string, NonNullable<ITtscCompilerTransformation.IInputObservation["nativePredicates"]>[number]>();
  for (const predicate of [...(left.nativePredicates ?? []), ...(right.nativePredicates ?? [])]) {
    for (const prior of native.values()) {
      if (prior.kind === predicate.kind &&
          (prior.version !== predicate.version || prior.digest !== predicate.digest ||
           prior.identityStable !== predicate.identityStable || prior.realpath !== predicate.realpath)) return undefined;
    }
    native.set(predicate.kind + ":" + predicate.scope, predicate);
  }
  const merged = { ...left, ...right,
    ...(native.size === 0 ? {} : { nativePredicates: [...native.values()].sort((a, b) => (a.kind + ":" + a.scope).localeCompare(b.kind + ":" + b.scope)) }),
  };
  return graphInputObservationCompatible(merged) ? merged : undefined;
}
