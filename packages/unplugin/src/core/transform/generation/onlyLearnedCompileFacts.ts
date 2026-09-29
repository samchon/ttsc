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
 * Whether an attempt failed only because its own compile reported a fact the
 * attempt needed before the compile began.
 *
 * Such an attempt says nothing about the project moving, so it is retried with
 * the fact in hand without spending the bound a moving project spends. A
 * dropped witness beyond the failure bound could be anything, so it counts as a
 * move.
 *
 * @param failures The attempt's recorded proof failures.
 *
 * @evidence contracts/common.md#principled-implementation A nonempty, lossless set containing only dependency-unwitnessed or case-policy-learned establishes missing prior knowledge rather than evidence of project movement; any omitted occurrence invalidates that classification.
 * @evidence contracts/common.md#clear-and-simple-design One predicate centralizes which proof classes consume the retry movement budget, leaving actual attempts and the absolute cap to transformProject.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The recognized kinds express real compile facts learned after pre-witnessing, and no omitted or mixed failure is excused by a fixture-specific retry exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the missing-knowledge distinction, retry consequence and conservative dropped-witness rule, with params and acknowledgment separation.
 * @evidence contracts/performance.md#efficient-algorithms Every scans the bounded retained entries with constant-time learned-kind Set membership and short-circuits at the first other failure.
 * @evidence contracts/performance.md#reuse-equivalent-work The fixed learned-kind Set is shared across attempts; aggregate classification uses the current attempt rather than memoizing mutable failure collections.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This predicate retains only two contract-defined kind strings; it acquires no per-attempt handles or historical result population.
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
