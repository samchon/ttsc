import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A `satisfies` expression, e.g. `value satisfies T`.
 *
 * Built by {@link factory.createSatisfiesExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SatisfiesExpression {
  /** Discriminant tag; always `"SatisfiesExpression"`. */
  kind: "SatisfiesExpression";

  /** The expression. */
  expression: Expression;

  /** The type. */
  type: TypeNode;
}
