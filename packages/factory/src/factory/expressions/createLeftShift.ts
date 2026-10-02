import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `<<` operator: bitwise left shift.
 *
 * Shorthand for {@link createBinaryExpression} with the `LessThanLessThanToken`
 * operator. Flat output uses spaces around it; width can break after it. As
 * with `<`, the printer keeps a right operand that holds a `>` followed by `(`
 * or a template from reading as type arguments, by writing it as `(+0 as number, ...)`.
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
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes value from shift amount and shows the printed expression; tags follow a separate blank comment line. The sentence on the (+0 as number, ...) operand states what the printer adds.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
