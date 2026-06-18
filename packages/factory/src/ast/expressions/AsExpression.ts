import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A type assertion, e.g. `value as T`.
 *
 * Built by {@link factory.createAsExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface AsExpression {
  /** Discriminant tag; always `"AsExpression"`. */
  kind: "AsExpression";

  /** The expression. */
  expression: Expression;

  /** The type. */
  type: TypeNode;
}
