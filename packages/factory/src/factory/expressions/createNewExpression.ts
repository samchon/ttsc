import type { Expression, NewExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NewExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The arguments.
 * @returns The created {@link NewExpression}.
 */
export const createNewExpression = (
  expression: Expression,
  typeArguments: readonly TypeNode[] | undefined,
  argumentsArray: readonly Expression[] | undefined,
): NewExpression =>
  make("NewExpression", {
    expression,
    typeArguments,
    arguments: argumentsArray,
  });
