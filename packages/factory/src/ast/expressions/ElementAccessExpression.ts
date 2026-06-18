import type { Expression } from "./Expression";

/**
 * An element access, e.g. `object[key]`.
 *
 * Built by {@link factory.createElementAccessExpression}.
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
