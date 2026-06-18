import type { Expression, NewExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NewExpression}: a constructor call with `new`.
 *
 * `expression` is the constructor being invoked. `typeArguments`, when present,
 * are printed in angle brackets after the constructor. `argumentsArray` holds
 * the call arguments; an empty array still prints the parentheses, so `new
 * Foo()` is emitted rather than `new Foo`.
 *
 * With `expression` of `Foo` and a single argument `a`, the printer emits:
 *
 * ```ts
 * new Foo(a);
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The constructor expression.
 * @param typeArguments The generic type arguments, if any.
 * @param argumentsArray The constructor arguments.
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
