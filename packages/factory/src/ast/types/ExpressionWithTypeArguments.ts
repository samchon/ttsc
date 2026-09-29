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
