import type { Expression } from "./Expression";

/**
 * A parenthesized expression, e.g. `(value)`.
 *
 * Built by {@link factory.createParenthesizedExpression}.
 *
 * Explicit grouping is retained even when the printer would not otherwise
 * need it. The wrapped expression still supplies the actual syntax and value.
 *
 * @evidence contracts/common.md#principled-implementation A dedicated wrapper records caller-requested grouping independently of operator precedence, preserving explicit parentheses around its operand.
 * @evidence contracts/common.md#clear-and-simple-design One inner expression is sufficient; the wrapper adds no copied operator state or precedence table.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Parentheses are represented structurally rather than inserted into raw operand text as a compensating output patch.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes explicit grouping from inferred parentheses; operand documentation and tags remain separated under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ParenthesizedExpression {
  /** Discriminant tag; always `"ParenthesizedExpression"`. */
  kind: "ParenthesizedExpression";

  /** The expression. */
  expression: Expression;
}
