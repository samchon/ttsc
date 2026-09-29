import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `<<` operator: bitwise left shift.
 *
 * Shorthand for {@link createBinaryExpression} with the `LessThanLessThanToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a << b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation LessThanLessThanToken retains value/shift-amount roles; the builder records bitwise left-shift syntax without implementing numeric conversion or range handling.
 * @evidence contracts/common.md#clear-and-simple-design The operator-specific wrapper delegates both operands to the shared binary node constructor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The left-shift token is the documented operation rather than a hardcoded multiplier selected for known amounts.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes value from shift amount and shows the printed expression; tags follow a separate blank comment line.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The value to shift.
 * @param right The shift amount.
 * @returns The created {@link BinaryExpression}.
 */
export const createLeftShift = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.LessThanLessThanToken, right);
