import type { Expression, TypeAssertion, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeAssertion}: the angle-bracket cast form `<Type>expr`.
 *
 * `type` is the asserted type and `expression` is the value being cast. The
 * printer wraps the type in angle brackets and places it before the expression
 * with no space. This is the older cast syntax; the `as` form is a separate
 * node.
 *
 * With `type` of `Foo` and `expression` of `x`, the printer emits:
 *
 * ```ts
 * <Foo>x
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The asserted type.
 * @param expression The expression to cast.
 * @returns The created {@link TypeAssertion}.
 */
export const createTypeAssertion = (
  type: TypeNode,
  expression: Expression,
): TypeAssertion => make("TypeAssertion", { type, expression });
