import type { Expression } from "./Expression";

/**
 * An array literal, e.g. `[1, 2, 3]`.
 *
 * Built by {@link factory.createArrayLiteralExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrayLiteralExpression {
  /** Discriminant tag; always `"ArrayLiteralExpression"`. */
  kind: "ArrayLiteralExpression";

  /** The array elements. */
  elements: readonly Expression[];

  /** When `true`, print one entry per line. */
  multiLine?: boolean;
}
