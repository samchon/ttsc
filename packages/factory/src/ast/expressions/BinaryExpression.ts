import type { SyntaxKind } from "../../syntax";
import type { Expression } from "./Expression";

/**
 * A binary expression, e.g. `a + b` or `a === b`.
 *
 * Built by {@link factory.createBinaryExpression}.
 *
 * SyntaxKind is broader than the set of binary operators. Callers must choose
 * a binary operator and operands legal for that operator, including assignment
 * target restrictions. The type performs no semantic validation.
 *
 * @evidence contracts/common.md#principled-implementation Left and right operands retain ordered roles around one lexical operator; broad SyntaxKind and Expression fields require caller-owned operator and assignment-target validity.
 * @evidence contracts/common.md#clear-and-simple-design Three direct constituents avoid separate representations for each binary operator; the printer owns precedence and associativity parentheses.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller's operator remains explicit syntax rather than selecting an operator from known answers or rewriting foreign nodes.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the broad-token limitation and assignment target premise; operand comments remain distinct from acknowledgment tags under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BinaryExpression {
  /** Discriminant tag; always `"BinaryExpression"`. */
  kind: "BinaryExpression";

  /** The left-hand operand. */
  left: Expression;

  /** The operator token. */
  operator: SyntaxKind;

  /** The right-hand operand. */
  right: Expression;
}
