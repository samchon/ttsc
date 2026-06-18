import type { CaseClause, Expression, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CaseClause}: one `case ...:` arm of a switch.
 *
 * The `expression` is the value matched against the switch subject, and
 * `statements` is the body that runs on a match. Fall-through is the default,
 * so include an explicit `break` in `statements` when you want the arm to
 * stop.
 *
 * With `expression` of `1` and `statements` of `a()` followed by a `break`, the
 * result is:
 *
 * ```ts
 * case 1:
 *   a();
 *   break;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statements The statements.
 * @returns The created {@link CaseClause}.
 */
export const createCaseClause = (
  expression: Expression,
  statements: readonly Statement[],
): CaseClause => make("CaseClause", { expression, statements });
