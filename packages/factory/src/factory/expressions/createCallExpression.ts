import type { CallExpression, Expression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The arguments.
 * @returns The created {@link CallExpression}.
 */
export const createCallExpression = (
  expression: Expression,
  typeArguments: readonly TypeNode[] | undefined,
  argumentsArray: readonly Expression[] | undefined,
): CallExpression =>
  make("CallExpression", {
    expression,
    typeArguments,
    arguments: argumentsArray ?? [],
  });
