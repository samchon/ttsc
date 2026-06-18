import type { Expression, SatisfiesExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SatisfiesExpression}: an expression checked against a type
 * with `satisfies`.
 *
 * `expression` is the value and `type` is the type it must conform to without
 * widening or narrowing its inferred type. The printer joins them with the
 * `satisfies` keyword surrounded by single spaces.
 *
 * With `expression` of `x` and `type` of `Foo`, the printer emits:
 *
 * ```ts
 * x satisfies Foo;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to check.
 * @param type The type the expression must satisfy.
 * @returns The created {@link SatisfiesExpression}.
 */
export const createSatisfiesExpression = (
  expression: Expression,
  type: TypeNode,
): SatisfiesExpression => make("SatisfiesExpression", { expression, type });
