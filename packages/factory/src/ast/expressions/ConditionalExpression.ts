import type { Expression } from "./Expression";

/**
 * A ternary conditional, e.g. `cond ? a : b`.
 *
 * Built by {@link factory.createConditionalExpression}.
 *
 * Both alternatives are stored as syntax. Constructing this node evaluates
 * neither the condition nor either branch.
 *
 * @evidence contracts/common.md#principled-implementation Distinct condition, true branch and false branch fields preserve ternary roles and ordering without prematurely choosing a value.
 * @evidence contracts/common.md#clear-and-simple-design The three grammar constituents are direct fields; punctuation and precedence are delegated to the printer rather than stored as tokens.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Both branches remain caller-supplied syntax rather than substituting a known condition's expected result.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies unevaluated branch storage; individually documented roles and a separate tag block follow documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConditionalExpression {
  /** Discriminant tag; always `"ConditionalExpression"`. */
  kind: "ConditionalExpression";

  /** The condition. */
  condition: Expression;

  /** The value when the condition holds. */
  whenTrue: Expression;

  /** The value otherwise. */
  whenFalse: Expression;
}
