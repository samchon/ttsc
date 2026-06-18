import type { CaseClause, Expression, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CaseClause}.
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
