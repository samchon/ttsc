import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Failures that say an attempt learned a fact of its compile too late to use. */
const LEARNED_FACTS = new Set([
  // A plugin-reported dependency path first named by this compile's envelope,
  // which had no witness read before it (samchon/ttsc#1541).
  "dependency-unwitnessed",
  // The compiler's case policy, first reported by this compile's envelope,
  // which the walk before it did not match under (samchon/ttsc#1545).
  "case-policy-learned",
]);

/**
 * Whether the retained, lossless failure aggregate names only facts learned
 * after the attempt's pre-compile observation.
 *
 * The retry owner carries learned dependencies and compiler case policy into
 * the next attempt, without spending its movement budget for this
 * classification. This predicate classifies recorded failures, not independent
 * disk stability; producers must record other failed proofs. An omitted witness
 * could be anything, so it prevents that exemption. The retry owner separately
 * enforces the absolute attempt cap and handles refuted adoptions.
 *
 * @param failures The attempt's recorded proof failures.
 * @evidence contracts/common.md#principled-implementation A nonempty aggregate with omitted=0 and only dependency-unwitnessed or case-policy-learned qualifies for the retry owner's learned-fact exemption. This is classification of supplied witnesses, not a separate proof of project stability; omitted or other recorded failures prevent the exemption.
 * @evidence contracts/common.md#clear-and-simple-design One predicate centralizes which proof classes consume the retry movement budget, leaving actual attempts and the absolute cap to transformProject.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The recognized kinds express real compile facts learned after pre-witnessing, and no omitted or mixed failure is excused by a fixture-specific retry exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the missing-knowledge distinction, retry consequence and conservative dropped-witness rule, with params and acknowledgment separation.
 * @evidence contracts/performance.md#efficient-algorithms Zero omissions and nonempty entries guard an every scan that stops at the first other kind. The recorder bounds normal retained count, while the supplied kind text still contributes to Set hashing/comparison. No per-call index or copied entry list is allocated.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The fixed two-kind lookup table is algorithm data, not shared completed or in-flight computation. This predicate recomputes classification of the supplied aggregate; transformProject owns retries and learned observations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows the aggregate and reads a fixed private two-kind table. It acquires no retained per-attempt state, handle or running task and controls no aggregate lifecycle.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Classifies failure kinds by a fixed set of strings; it reads no filesystem or path.
 */
export function onlyLearnedCompileFacts(
  failures: TtscGenerationProofFailures,
): boolean {
  return (
    failures.omitted === 0 &&
    failures.entries.length !== 0 &&
    failures.entries.every((failure) => LEARNED_FACTS.has(failure.kind))
  );
}
