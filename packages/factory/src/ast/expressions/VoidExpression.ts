import type { Expression } from "./Expression";

/**
 * A `void` expression.
 *
 * Built by {@link factory.createVoidExpression}.
 *
 * The operand remains in source syntax even though `void` discards its value;
 * replacing the whole expression with `undefined` could lose operand effects.
 * Constructing the node does not evaluate it.
 *
 * @evidence contracts/common.md#principled-implementation Retaining the operand represents void's evaluation followed by discarded value, rather than modeling only its undefined result and losing possible operand effects.
 * @evidence contracts/common.md#clear-and-simple-design A single operand and discriminant capture the operation without a second discarded-value field or evaluation layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The outline does not substitute undefined for the operation or erase a supplied operand to match known outputs.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains why operand syntax remains and construction does not evaluate it; the member and tags follow documentation separation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface VoidExpression {
  /** Discriminant tag; always `"VoidExpression"`. */
  kind: "VoidExpression";

  /** Operand evaluated by emitted code before its value is discarded. */
  expression: Expression;
}
