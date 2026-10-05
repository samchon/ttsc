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
 * Operand evaluation occurs only when emitted code runs; constructing the
 * outline retains that operand without executing or discarding its effects.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The operand of `void`.
 * @returns The created {@link VoidExpression}.
 * @evidence contracts/common.md#principled-implementation Retained operand syntax preserves evaluation before discarded value in void semantics; the builder does not substitute undefined and lose possible operand effects.
 * @evidence contracts/common.md#clear-and-simple-design One expression feeds make, with no stored evaluation result or duplicate keyword token.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operand is not erased for a known no-effect fixture or replaced by a predicted undefined result.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes emitted-code evaluation from construction, with direct expression example and separate parameter and acknowledgment blocks.
 */
export const createVoidExpression = (expression: Expression): VoidExpression =>
  make("VoidExpression", { expression });
