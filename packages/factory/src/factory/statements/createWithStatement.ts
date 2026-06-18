import type { Expression, Statement, WithStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link WithStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link WithStatement}.
 */
export const createWithStatement = (
  expression: Expression,
  statement: Statement,
): WithStatement => make("WithStatement", { expression, statement });
