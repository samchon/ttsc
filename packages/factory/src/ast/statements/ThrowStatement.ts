import type { Expression } from "../expressions/Expression";

/**
 * A `throw` statement.
 *
 * Built by {@link factory.createThrowStatement}.
 *
 * @evidence contracts/common.md#principled-implementation A required Expression preserves the value after throw; the shape records syntax without raising an exception itself.
 * @evidence contracts/common.md#clear-and-simple-design One operand field carries the complete variable payload of a throw statement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Thrown values are supplied data, with no hidden retry or runtime error substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies throw syntax and its thrown operand; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ThrowStatement {
  /** Discriminant tag; always `"ThrowStatement"`. */
  kind: "ThrowStatement";

  /** Value expression printed after throw. */
  expression: Expression;
}
