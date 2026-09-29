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
 * typeof x
 * ```
 *
 * This is a value-space operator, not a type query. Construction does not
 * evaluate the operand or compute its runtime type string.
 *
 * @evidence contracts/common.md#principled-implementation The typeof expression kind retains a runtime operator operand, distinguishing it from a type-space query without predicting the result string.
 * @evidence contracts/common.md#clear-and-simple-design One operand and shared make call are sufficient; the printer owns keyword spacing and grouping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operand is not replaced with a known fixture's type string or queried through a patched host object.
 * @evidence contracts/common.md#meaningful-documentation Native prose states value-space meaning and no construction-time evaluation; the example and parameter description remain separate from tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The operand of `typeof`.
 * @returns The created {@link TypeOfExpression}.
 */
export const createTypeOfExpression = (
  expression: Expression,
): TypeOfExpression => make("TypeOfExpression", { expression });
