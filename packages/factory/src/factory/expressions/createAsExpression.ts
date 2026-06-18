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
 * value as string;
 * ```
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
