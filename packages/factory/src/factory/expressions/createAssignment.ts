import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `=` operator: a simple assignment.
 *
 * Shorthand for {@link createBinaryExpression} with the `EqualsToken` operator.
 * The left operand is the assignment target and the right operand is the value.
 * Flat output surrounds the operator with spaces; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a = b;
 * ```
 *
 * Callers supply a legal assignment target; constructing the outline performs
 * no assignment or target validation.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The assignment target.
 * @param right The value to assign.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation EqualsToken preserves target/value ordering for assignment syntax; the left expression must be a legal target supplied by the caller.
 * @evidence contracts/common.md#clear-and-simple-design The helper delegates its two operands and one operator to the binary constructor instead of duplicating assignment node creation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The equals token is the requested assignment operation; the builder does not mutate the target or preselect its new value.
 * @evidence contracts/common.md#meaningful-documentation Native prose states target validity and no host assignment; the example, parameter descriptions and acknowledgment block remain separate.
 */
export const createAssignment = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.EqualsToken, right);
