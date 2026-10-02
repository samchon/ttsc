import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a signed right-shift expression: `left >> right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `>>` operator. The
 * printer keeps the right operand on the operator's line instead of breaking
 * after it.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a >> b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation GreaterThanGreaterThanToken records signed right-shift syntax, preserving value and amount instead of substituting unsigned or division semantics.
 * @evidence contracts/common.md#clear-and-simple-design One shared binary-constructor call keeps shift representation common with other infix operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The signed-shift token is explicit, without input-selected masks or precomputed shift results.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies signed shifting and both operands; the expression example and tags are separate under documentation guidance.
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
export const createRightShift = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.GreaterThanGreaterThanToken, right);
