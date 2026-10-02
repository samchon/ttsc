import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a multiplication expression: `left * right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `*` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a * b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation AsteriskToken retains multiplication syntax with both original operands; numeric behavior is left to the emitted language.
 * @evidence contracts/common.md#clear-and-simple-design The shared binary constructor owns the node, with this wrapper only choosing multiplication.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No expected product or consumer-specific scale replaces the supplied operand expressions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names multiplication, explains the wrapper and operand roles, and separates expression example from acknowledgment tags.
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
export const createMultiply = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.AsteriskToken, right);
