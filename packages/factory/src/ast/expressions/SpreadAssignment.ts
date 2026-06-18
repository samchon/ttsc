import type { Expression } from "./Expression";

/**
 * A spread member of an object literal, e.g. `{ ...rest }`.
 *
 * Built by {@link factory.createSpreadAssignment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SpreadAssignment {
  /** Discriminant tag; always `"SpreadAssignment"`. */
  kind: "SpreadAssignment";

  /** The expression. */
  expression: Expression;
}
