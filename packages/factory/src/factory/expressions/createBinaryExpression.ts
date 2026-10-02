import type { BinaryExpression, Expression, Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link BinaryExpression}: two operands joined by an infix operator.
 *
 * The operator may be given as a `SyntaxKind` string (e.g. `"+"`, `"==="`,
 * `"&&"`) or as an operator {@link Token}, in which case its `token` value is
 * used. This is the base builder behind the operator-specific shorthands such
 * as {@link createAdd}, {@link createStrictEquality} and
 * {@link createLogicalAnd}.
 *
 * Flat output surrounds ordinary operators with spaces. Commas attach to the
 * left operand; width can replace the following space with a line break, except
 * after `>` and `>>`, which keep their right operand on the same line.
 *
 * Given operands `a`, `b` and the `+` operator, the printer emits:
 *
 * ```ts
 * a + b
 * ```
 *
 * SyntaxKind and Token accept more than legal binary operators. Callers supply
 * an appropriate operator and valid operands, including assignment targets.
 * No lexical or semantic validation is performed here.
 *
 * @evidence contracts/common.md#principled-implementation A token operand normalizes to its token spelling and both expression operands retain their roles; legal binary operator and target validity remain caller premises for the broad accepted types.
 * @evidence contracts/common.md#clear-and-simple-design One normalization and shared make call own binary construction; operator-specific helpers delegate here rather than duplicating node shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Extracting an explicit Token's spelling follows the accepted input contract, without consumer-based operator guessing or mutations of foreign nodes.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states accepted operator representations and validation limits, with an example, ordered parameters and separate acknowledgment block under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param operator The operator token or its `SyntaxKind`.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createBinaryExpression = (
  left: Expression,
  operator: SyntaxKind | Token,
  right: Expression,
): BinaryExpression =>
  make("BinaryExpression", {
    left,
    operator: typeof operator === "object" ? operator.token : operator,
    right,
  });
