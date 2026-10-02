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
 * a = b
 * ```
 *
 * Callers supply a legal assignment target; constructing the outline performs
 * no assignment or target validation.
 *
 * @evidence contracts/common.md#principled-implementation EqualsToken preserves target/value ordering for assignment syntax; the left expression must be a legal target supplied by the caller.
 * @evidence contracts/common.md#clear-and-simple-design The helper delegates its two operands and one operator to the binary constructor instead of duplicating assignment node creation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The equals token is the requested assignment operation; the builder does not mutate the target or preselect its new value.
 * @evidence contracts/common.md#meaningful-documentation Native prose states target validity and no host assignment; the example, parameter descriptions and acknowledgment block remain separate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The assignment target.
 * @param right The value to assign.
 * @returns The created {@link BinaryExpression}.
 */
export const createAssignment = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.EqualsToken, right);
