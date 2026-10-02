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
 * a & b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation AmpersandToken and unchanged left/right operands represent bitwise AND syntax without computing or validating runtime numeric conversions.
 * @evidence contracts/common.md#clear-and-simple-design One operator-specific delegation reuses the binary node constructor and its operand representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed ampersand is the helper's operation, not a mask chosen from known consumer inputs.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies bitwise AND, operand roles and the printed expression; prose and tags are separate following documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createBitwiseAnd = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.AmpersandToken, right);
