import type { Expression, NonNullExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NonNullExpression}: a non-null assertion that suffixes
 * `expression` with `!`.
 *
 * The assertion strips `null` and `undefined` from the operand's type at
 * compile time. The printer appends a single `!` directly after the operand
 * with no space.
 *
 * With `expression` of `a`, the printer emits:
 *
 * ```ts
 * a!;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to assert as non-null.
 * @returns The created {@link NonNullExpression}.
 */
export const createNonNullExpression = (
  expression: Expression,
): NonNullExpression => make("NonNullExpression", { expression });
