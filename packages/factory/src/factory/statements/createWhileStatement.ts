import type { Expression, Statement, WhileStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link WhileStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link WhileStatement}.
 */
export const createWhileStatement = (
  expression: Expression,
  statement: Statement,
): WhileStatement => make("WhileStatement", { expression, statement });
