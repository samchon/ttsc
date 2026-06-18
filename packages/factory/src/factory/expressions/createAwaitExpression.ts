import type { AwaitExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link AwaitExpression}: an `await` of an operand.
 *
 * The printer writes the `await` keyword followed by a single space and the
 * operand expression.
 *
 * Given operand `promise`, the printer emits:
 *
 * ```ts
 * await promise;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The awaited expression.
 * @returns The created {@link AwaitExpression}.
 */
export const createAwaitExpression = (
  expression: Expression,
): AwaitExpression => make("AwaitExpression", { expression });
