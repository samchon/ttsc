import type { Node } from "../Node";
import type { Expression } from "./Expression";

/**
 * An expression wrapper that prints its inner expression without adding syntax.
 *
 * Built by {@link factory.createPartiallyEmittedExpression}.
 *
 * The optional original node is provenance only and is not printed. This
 * wrapper does not strip type syntax contained in its inner expression.
 *
 * @evidence contracts/common.md#principled-implementation The inner Expression supplies emitted meaning, while original retains optional provenance independently; printer dispatch ignores provenance and transparently emits the operand.
 * @evidence contracts/common.md#clear-and-simple-design Two fields separate emission input from source association without copying the original tree into printed syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit provenance does not replace the operand with a guessed original rendering or hide a type-erasure transformation inside the wrapper.
 * @evidence contracts/common.md#meaningful-documentation Native prose states transparency, ignored provenance and the absence of type stripping; member explanations and tags use separate blocks under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PartiallyEmittedExpression {
  /** Discriminant tag; always `"PartiallyEmittedExpression"`. */
  kind: "PartiallyEmittedExpression";

  /** The expression to emit. */
  expression: Expression;

  /** Optional provenance; the printer does not emit this node. */
  original?: Node;
}
