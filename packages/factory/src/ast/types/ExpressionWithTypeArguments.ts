import type { Expression } from "../expressions/Expression";
import type { TypeNode } from "./TypeNode";

/**
 * An expression with type arguments, used in heritage clauses.
 *
 * Built by {@link factory.createExpressionWithTypeArguments}.
 *
 * @evidence contracts/common.md#principled-implementation An expression and optional ordered TypeNodes preserve a generic heritage reference; the broad expression union does not validate legal bases.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns type-argument attachment while Expression owns the base expression form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Base expressions are supplied data; no consumer-specific heritage targets are embedded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies heritage use and absent generic arguments; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExpressionWithTypeArguments {
  /** Discriminant tag; always `"ExpressionWithTypeArguments"`. */
  kind: "ExpressionWithTypeArguments";

  /** The expression. */
  expression: Expression;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];
}
