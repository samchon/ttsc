import type { DoStatement, Expression, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DoStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statement The statement.
 * @param expression The expression.
 * @returns The created {@link DoStatement}.
 */
export const createDoStatement = (
  statement: Statement,
  expression: Expression,
): DoStatement => make("DoStatement", { statement, expression });
