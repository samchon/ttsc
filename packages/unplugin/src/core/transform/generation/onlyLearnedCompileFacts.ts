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
