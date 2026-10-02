import type { Expression } from "./Expression";

/**
 * An element access, e.g. `object[key]`.
 *
 * Built by {@link factory.createElementAccessExpression}.
 *
 * This ordinary access keeps the receiver and dynamic index as unevaluated
 * syntax. Use a chain node when the link continues optional chaining.
 *
 * @evidence contracts/common.md#principled-implementation Receiver and index expressions retain the two roles of indexed access; the ordinary kind distinguishes its boundary from an optional-chain continuation.
 * @evidence contracts/common.md#clear-and-simple-design Two direct operands represent the access without a second cached key or property lookup abstraction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The declaration retains the actual index expression instead of guessing a fixed member from a known receiver.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains ordinary versus chain access and unevaluated operands; separate member comments and acknowledgment tags follow documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ElementAccessExpression {
  /** Discriminant tag; always `"ElementAccessExpression"`. */
  kind: "ElementAccessExpression";

  /** The expression. */
  expression: Expression;

  /** The index or key expression. */
  argumentExpression: Expression;
}
