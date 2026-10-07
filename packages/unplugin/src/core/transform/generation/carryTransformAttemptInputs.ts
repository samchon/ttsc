import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Carry the rejected capture's learned names and compiler rule into its retry.
 *
 * Exact dependency spellings form an insertion-ordered union, not a physical
 * identity index. The next capture observes those names again before compiling;
 * retaining a name supplies no retained byte, metadata or notification proof.
 * An absent captured case answer leaves the previous answer unchanged.
 *
 * @evidence contracts/common.md#principled-implementation A fresh Set preserves prior insertion order and adds newly reported external names once under string equality. Nullish case precedence preserves explicit false and a previous unknown answer.
 * @evidence contracts/common.md#clear-and-simple-design This input transition returns next-attempt facts without mutating the supplied Set or capture; the retry caller owns capture admission, observation and disposal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Learned names are not native identity or fresh proof, and no omitted diagnostic witness is invented as a dependency. Reported external inputs remain distinct from bounded failure samples.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains lexical union order, optional case carry and the requirement for the next capture to obtain new observations.
 * @evidence contracts/portability.md#os-neutral-implementation Carries the compiler comparison boolean unchanged and keeps reported native spellings distinct; it neither folds paths by OS name nor canonicalizes them without the filesystem owner.
 * @evidence contracts/performance.md#efficient-algorithms One Set copy plus one reported-input scan preserves nonmutation and insertion order. Time follows prior and reported name counts with string hashing costs; temporary Set space follows their unique union. This copy replaces the retry owner's in-place update and is not claimed to accelerate it.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Carries names and a comparison rule, not observations or reusable compilation proof; the next capture must witness its own environment.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Transfers a newly allocated Set to the retry owner without storing history or acquiring handles. The caller owns cumulative name retention and capture-resource release.
 */
export function carryTransformAttemptInputs(
  witnessed: ReadonlySet<string>,
  useCaseSensitiveFileNames: boolean | undefined,
  captured: Pick<
    TtscCachedProjectTransform,
    "externalDependencyInputs" | "membershipPolicy"
  >,
): {
  /** Caller-owned lexical union to observe before the next compilation. */
  witnessed: Set<string>;

  /** Latest supplied compiler rule, preserving unknown when none is available. */
  useCaseSensitiveFileNames: boolean | undefined;
} {
  const nextWitnessed = new Set(witnessed);
  for (const dependency of captured.externalDependencyInputs ?? []) {
    nextWitnessed.add(dependency);
  }
  return {
    witnessed: nextWitnessed,
    useCaseSensitiveFileNames:
      captured.membershipPolicy.useCaseSensitiveFileNames ??
      useCaseSensitiveFileNames,
  };
}
