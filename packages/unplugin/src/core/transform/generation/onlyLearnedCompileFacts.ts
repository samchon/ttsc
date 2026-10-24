import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Failures that say an attempt learned a fact of its compile too late to use. */
const LEARNED_FACTS = new Set([
  // A plugin-reported dependency path first named by this compile's envelope,
  // which had no witness read before it (samchon/ttsc#1541).
  "dependency-unwitnessed",
  // The compiler's case policy, first reported by this compile's envelope,
  // which the walk before it did not match under (samchon/ttsc#1545).
  "case-policy-learned",
  // Effective suffix/output settings reported after provisional root discovery.
  "membership-policy-learned",
]);

/**
 * Whether the retained, lossless failure aggregate names only facts learned
 * after the attempt's pre-compile observation.
 *
 * The retry owner carries learned dependencies and compiler membership policy
 * into the next attempt, without spending its movement budget for this
 * classification. This predicate classifies recorded failures, not independent
 * disk stability; producers must record other failed proofs. An omitted witness
 * could be anything, so it prevents that exemption. The retry owner separately
 * enforces the absolute attempt cap and handles refuted adoptions.
 *
 * @param failures The attempt's recorded proof failures.
 * @evidence contracts/common.md#principled-implementation A nonempty lossless aggregate containing only dependency-unwitnessed, case-policy-learned or membership-policy-learned qualifies for the learned-fact exemption. Other recorded failures prevent it; this classification is not independent proof of project stability.
 * @evidence contracts/common.md#clear-and-simple-design One predicate centralizes which proof classes consume the retry movement budget, leaving actual attempts and the absolute cap to transformProject.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The recognized kinds express real compile facts learned after pre-witnessing, and no omitted or mixed failure is excused by a fixture-specific retry exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the missing-knowledge distinction, retry consequence and conservative dropped-witness rule, with params and acknowledgment separation.
 * @evidence contracts/performance.md#efficient-algorithms Zero omissions and nonempty entries guard an every scan that stops at the first other kind. The recorder bounds normal retained count, while the supplied kind text still contributes to Set hashing/comparison. No per-call index or copied entry list is allocated.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The fixed kind table is algorithm data, not cached computation. The retry owner carries learned observations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows the aggregate and reads a fixed private table without acquiring state or handles.
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
