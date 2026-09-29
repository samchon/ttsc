import type { AsExpression, Expression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link AsExpression}: a TypeScript `expression as type` assertion.
 *
 * The printer writes the expression, the `as` keyword and the target type, each
 * separated by a single space.
 *
 * Given expression `value` and type `string`, the printer emits:
 *
 * ```ts
 * value as string
 * ```
 *
 * Construction records syntax without assignability checking or conversion.
 *
 * @evidence contracts/common.md#principled-implementation Separate operand and TypeNode fields retain as-assertion syntax; this outline does not establish the asserted type or convert runtime values.
 * @evidence contracts/common.md#clear-and-simple-design Direct construction leaves assertion punctuation and operand grouping to the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's assertion remains explicit rather than coercing the operand or supplying a fabricated type-check result.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes syntax construction from checking and conversion; the example and acknowledgment block remain separated under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression being asserted.
 * @param type The target type.
 * @returns The created {@link AsExpression}.
 */
export const createAsExpression = (
  expression: Expression,
  type: TypeNode,
): AsExpression => make("AsExpression", { expression, type });
