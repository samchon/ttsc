import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Whether a bare filename has an extension admitted by the project policy.
 *
 * Literal expressions preserve Unicode simple case folding without expanding or
 * contextually lowercasing either operand. This remains conservative root
 * eligibility, independently of filesystem identity or compiler enumeration.
 *
 * @evidence contracts/common.md#principled-implementation Escaped literal suffixes use Unicode simple folding and a strict end boundary; this preserves dotted I and contextual sigma without treating mapper punctuation as regex grammar.
 * @evidence contracts/common.md#clear-and-simple-design One weakly owned expression list per immutable policy serves an early-terminating suffix scan without filesystem work.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate uses compiler-derived extension policy rather than selected test filenames or bundler output-directory exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native comment states the bare-name input and policy boundary, avoiding an ambiguous reference to another helper's question.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares basename text using literal Unicode suffixes; it reads no filesystem or OS-name policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A cold policy compiles its suffix text once. Queries scan the supplied
 *   expressions until a match, with literal search work following filename
 *   length and suffix text; no authored wildcard or repeated pattern activates
 *   backtracking partitions. Retained expression text follows the suffix list.
 * @evidence contracts/performance.md#reuse-equivalent-work Compiled literal expressions are shared only by the same immutable policy identity; changing its suffix list requires a new policy, as other membership matchers require.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The WeakMap retains expressions while their policy remains reachable and does not pin discarded policies; there are no filename histories, handles or timers.
 */
export function isPossibleProgramFileName(
  name: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  let patterns = compiled.get(policy);
  if (patterns === undefined) {
    patterns = policy.inputExtensions.map(
      (extension) =>
        new RegExp(
          `${extension.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}(?![\\s\\S])`,
          "iu",
        ),
    );
    compiled.set(policy, patterns);
  }
  return patterns.some((pattern) => pattern.test(name));
}

/** Literal suffix expressions owned weakly by immutable membership policy. */
const compiled = new WeakMap<ITtscProjectMembershipPolicy, readonly RegExp[]>();
