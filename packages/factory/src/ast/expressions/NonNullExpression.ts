import type { Expression } from "./Expression";

/**
 * A non-null assertion, e.g. `value!`.
 *
 * Built by {@link factory.createNonNullExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NonNullExpression {
  /** Discriminant tag; always `"NonNullExpression"`. */
  kind: "NonNullExpression";

  /** The expression. */
  expression: Expression;
}
