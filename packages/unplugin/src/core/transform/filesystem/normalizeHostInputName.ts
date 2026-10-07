/**
 * Fold ASCII letters for a directory watch's coarse name filter.
 *
 * Non-ASCII spelling is preserved so the consumer can recognize uncertainty.
 * Case policy alone does not define native normalization or Windows short-name
 * aliases; this value cannot prove that a different native spelling is absent.
 *
 * @evidence contracts/common.md#principled-implementation Sensitive policy preserves spelling; insensitive policy folds only ASCII letters. Non-ASCII remains visible to consumers that withdraw uncertain lexical filters, while native stat owns existence proof.
 * @evidence contracts/common.md#clear-and-simple-design One explicit policy parameter controls entry normalization without rereading directory capability or resolving a whole path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The coarse filter does not substitute JavaScript Unicode folding or guessed short-name syntax for actual native equivalence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state ASCII-only scope and why preserved non-ASCII spelling still requires an uncertainty decision.
 * @evidence contracts/portability.md#os-neutral-implementation The caller's measured case policy selects coarse ASCII folding; normalization and alternate native names remain separate capabilities that this helper cannot infer.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Sensitive input returns directly; insensitive replacement scans the name
 *   once with fixed one-character ASCII matches and output bounded by its length.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This stateless spelling projection does not coordinate request validity;
 *   the watch-location owner stores its projected names for the subscription.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function normalizeHostInputName(
  name: string,
  caseSensitive: boolean,
): string {
  return caseSensitive
    ? name
    : name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
