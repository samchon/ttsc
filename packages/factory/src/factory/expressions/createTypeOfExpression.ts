import type { Expression, TypeOfExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeOfExpression}: the `typeof` operator applied to a value.
 *
 * `expression` is the operand. The printer writes the `typeof` keyword followed
 * by a single space and then the operand.
 *
 * With `expression` of `x`, the printer emits:
 *
 * ```ts
 * typeof x;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The operand of `typeof`.
 * @returns The created {@link TypeOfExpression}.
 */
export const createTypeOfExpression = (
  expression: Expression,
): TypeOfExpression => make("TypeOfExpression", { expression });
