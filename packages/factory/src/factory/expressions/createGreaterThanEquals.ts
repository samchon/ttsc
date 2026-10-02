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
export const createGreaterThanEquals = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.GreaterThanEqualsToken, right);
