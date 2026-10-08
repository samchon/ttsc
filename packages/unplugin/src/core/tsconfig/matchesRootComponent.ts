import type { IRootPattern } from "./IRootPattern";

/**
 * Match one compiled filename component without searching wildcard partitions.
 *
 * A token position is a possible prefix of the pattern. A star can advance
 * without consuming text or stay in place while consuming a nonseparator; other
 * tokens consume one Unicode code point. Equal positions merge before the next
 * character, so repeated stars never multiply equivalent searches. Literal
 * token expressions contain one escaped code point, retaining the compiler's
 * Unicode simple-folding rule without lowercasing filenames.
 *
 * The expression must come from compile: a whole literal expression has no
 * wildcard, and each token expression matches exactly one literal code point.
 * Leading wildcard components exclude a leading dot; literal dots remain
 * eligible. Package, minified-file and directory rules belong to matches.
 *
 * @evidence contracts/common.md#principled-implementation Star epsilon/consuming transitions and one-code-point literal/question transitions recognize the compiled component language. Merging identical token positions preserves every possible match without enumerating partitions; Unicode iteration and u/iu literal predicates retain existing character and case semantics.
 * @evidence contracts/common.md#clear-and-simple-design One component matcher owns token-state traversal; compile owns tokens and matches retains path-level policy and recursive-directory states.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No filename exception, timeout, foreign mutation or alternate compiler policy replaces matching; the generated repeated-wildcard regexp is removed at its source.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the transition meaning, compiler-owned expression precondition and hidden-name boundary separately from path policy.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Consumes compiler-language text and compiled comparison predicates, not native paths or filesystem capabilities.
 * @evidence contracts/performance.md#efficient-algorithms For T tokens and N candidate code points, each epsilon expansion visits at most T+1 distinct positions and each character tests at most T tokens: O((N+1)(T+1)) state work and O(T+1) temporary state. Two call-local Sets exchange roles and clear old positions rather than allocating a container per character. Literal predicates contain one escaped code point with no quantifier; whole literal expressions retain their pattern/text cost. No candidate code-point array or wildcard-partition tree is materialized.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Merges equivalent positions within one component evaluation; cross-query compiled pattern reuse remains with matchesProjectRootFile.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local state sets are acquired; no handle, historical result or callback is retained.
 */
export function matchesRootComponent(
  part: string,
  expression: Exclude<IRootPattern["components"][number], string>["expression"],
): boolean {
  if (expression instanceof RegExp) return expression.test(part);
  if ((expression[0] === "*" || expression[0] === "?") && part.startsWith("."))
    return false;
  let states = new Set([0]);
  let next = new Set<number>();
  const expand = (): void => {
    for (const state of states)
      if (expression[state] === "*") states.add(state + 1);
  };
  for (const character of part) {
    expand();
    next.clear();
    for (const state of states) {
      const token = expression[state];
      if (token === undefined) continue;
      if (token === "*") {
        if (character !== "/") next.add(state);
      } else if (token === "?" ? character !== "/" : token.test(character))
        next.add(state + 1);
    }
    if (next.size === 0) return false;
    const previous = states;
    states = next;
    next = previous;
  }
  expand();
  return states.has(expression.length);
}
