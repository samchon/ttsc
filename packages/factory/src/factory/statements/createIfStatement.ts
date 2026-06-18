import type { Expression, IfStatement, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link IfStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param thenStatement The statement run when the condition holds.
 * @param elseStatement The statement run otherwise, if any.
 * @returns The created {@link IfStatement}.
 */
export const createIfStatement = (
  expression: Expression,
  thenStatement: Statement,
  elseStatement?: Statement,
): IfStatement =>
  make("IfStatement", { expression, thenStatement, elseStatement });
