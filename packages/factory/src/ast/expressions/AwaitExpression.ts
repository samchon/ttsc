import type { Expression } from "./Expression";

/**
 * An `await` expression.
 *
 * Built by {@link factory.createAwaitExpression}.
 *
 * The node records an operand only. Whether `await` is allowed in the enclosing
 * function or module is not checked by this outline.
 *
 * @evidence contracts/common.md#principled-implementation A single expression operand and the AwaitExpression kind represent await syntax; enclosing async or module legality is a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design The operand is direct syntax data; execution scheduling and scope analysis are not stored in the node.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Await is represented as its own syntax kind rather than a patched promise or a guessed synchronous result.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the enclosing-context limit; operand documentation and acknowledgment separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface AwaitExpression {
  /** Discriminant tag; always `"AwaitExpression"`. */
  kind: "AwaitExpression";

  /** The expression. */
  expression: Expression;
}
