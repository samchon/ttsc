import type { Expression } from "./Expression";

/**
 * A comma-separated expression list, e.g. `(a, b, c)`.
 *
 * Built by {@link factory.createCommaListExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CommaListExpression {
  /** Discriminant tag; always `"CommaListExpression"`. */
  kind: "CommaListExpression";

  /** Elements. */
  elements: readonly Expression[];
}
