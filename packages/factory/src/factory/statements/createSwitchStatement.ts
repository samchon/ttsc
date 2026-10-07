import type { CaseBlock, Expression, SwitchStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SwitchStatement}: a `switch (...) { ... }` statement.
 *
 * The `expression` is the subject compared against each arm, and `caseBlock` is
 * the braced body of `case` and `default` clauses, built with
 * {@link createCaseBlock}.
 *
 * With `expression` of `x` and a `caseBlock` holding a `case 1:` arm (calling
 * `a()` then `break`) and a `default:` arm (calling `b()`), the result is:
 *
 * ```ts
 * switch (x) {
 *   case 1:
 *     a();
 *     break;
 *   default:
 *     b();
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param caseBlock The caseBlock.
 * @returns The created {@link SwitchStatement}.
 * @evidence contracts/common.md#principled-implementation
 *   The subject Expression and CaseBlock remain distinct, preserving one switch
 *   evaluation with ordered case/default arms supplied by the caller.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Switch context stays here, while CaseBlock and its clauses own grouping
 *   and body syntax; no alternate matching algorithm is introduced.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Arms are not replaced with precomputed expected branch results.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies subject/body ownership with a multi-arm example;
 *   acknowledgment paragraphs remain separate from the descriptive block.
 */
export const createSwitchStatement = (
  expression: Expression,
  caseBlock: CaseBlock,
): SwitchStatement => make("SwitchStatement", { expression, caseBlock });
