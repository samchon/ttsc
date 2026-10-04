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
 * @evidence contracts/common.md#principled-implementation Repeated normalized predicates must serialize identically, after which cross-predicate compatibility rejects contradictory combinations. Independent predicate records merge without replacing either input.
 * @evidence contracts/common.md#clear-and-simple-design This operation owns duplicate observation union; normalization, permanent conflict indexing, legacy projection and native replay remain separate boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Conflicting predicate or listing values return no merged proof; a later predicate cannot silently repair the earlier contradictory observation.
 * @evidence contracts/common.md#meaningful-documentation Native prose specifies normalized inputs, significant listing order and conflict versus absence, without claiming live filesystem agreement.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares normalized recorded predicate values in memory; native path grammar, identity resolution and live observation belong to the producer and validator.
 * @evidence contracts/performance.md#efficient-algorithms At most six repeated predicates are serialized for comparison, followed by one shallow merge and compatibility check. Work and temporary strings follow repeated listing and path payload bytes, not just predicate count; no native input is read.
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
  const merged = { ...left, ...right };
  return graphInputObservationCompatible(merged) ? merged : undefined;
}
