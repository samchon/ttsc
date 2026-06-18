import type { Expression, VoidExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link VoidExpression}: the `void` operator applied to a value.
 *
 * `expression` is the operand, which is evaluated and then discarded so the
 * whole expression yields `undefined`. The printer writes the `void` keyword, a
 * single space, and the operand.
 *
 * With `expression` of `0`, the printer emits:
 *
 * ```ts
 * void 0;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The operand of `void`.
 * @returns The created {@link VoidExpression}.
 */
export const createVoidExpression = (expression: Expression): VoidExpression =>
  make("VoidExpression", { expression });
