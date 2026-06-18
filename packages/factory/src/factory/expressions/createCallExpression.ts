import type { CallExpression, Expression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallExpression}: a function or method call.
 *
 * The optional `typeArguments` are printed in `<...>` before the argument list.
 * The arguments are printed comma separated inside the parentheses, and a
 * missing `argumentsArray` is treated as an empty list.
 *
 * Given callee `fn` and arguments `a`, `b`, the printer emits:
 *
 * ```ts
 * fn(a, b);
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The callee expression.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The call arguments.
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
