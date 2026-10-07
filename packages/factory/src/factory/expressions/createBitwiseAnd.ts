import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `&` operator: bitwise AND.
 *
 * Shorthand for {@link createBinaryExpression} with the `AmpersandToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a & b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation AmpersandToken and unchanged left/right operands represent bitwise AND syntax without computing or validating runtime numeric conversions.
 * @evidence contracts/common.md#clear-and-simple-design One operator-specific delegation reuses the binary node constructor and its operand representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed ampersand is the helper's operation, not a mask chosen from known consumer inputs.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies bitwise AND, operand roles and the printed expression; prose and tags are separate following documentation guidance.
 */
export const createBitwiseAnd = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.AmpersandToken, right);
