import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `>=` operator: greater-than-or-
 * equal comparison.
 *
 * Shorthand for {@link createBinaryExpression} with the `GreaterThanEqualsToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a >= b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation GreaterThanEqualsToken retains the inclusive relation with left/right order unchanged; no runtime result is computed here.
 * @evidence contracts/common.md#clear-and-simple-design Inclusive comparison delegates to the existing binary constructor rather than decomposing the operation into multiple comparisons.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The inclusive operator is explicit syntax instead of a patched strict-comparison result for boundary cases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the inclusive operation and operand roles, with a separate expression example and acknowledgment block.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createGreaterThanEquals = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.GreaterThanEqualsToken, right);
