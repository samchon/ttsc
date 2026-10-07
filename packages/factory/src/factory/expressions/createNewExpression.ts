import type { Expression, NewExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NewExpression}: a constructor call with `new`.
 *
 * `expression` is the constructor being invoked. `typeArguments`, when present,
 * are printed in angle brackets after the constructor. `argumentsArray` holds
 * the call arguments; an absent or empty list both print parentheses. The
 * outline does not check whether the supplied target is constructible.
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
 * @evidence contracts/common.md#principled-implementation Constructor target and optional argument sequences remain supplied new-expression syntax; undefined arguments are preserved in the node but print as (), and constructibility remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One make call records the constituents, with target grouping and argument-list normalization owned by the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's target is not replaced by an injected constructor or a known instance; empty parentheses follow the documented printer contract.
 * @evidence contracts/common.md#meaningful-documentation Native prose states absent-list behavior and constructibility limits, with direct expression example and separate parameters/tags under documentation guidance.
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
