import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `do...while` loop.
 *
 * Built by {@link factory.createDoStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DoStatement {
  /** Discriminant tag; always `"DoStatement"`. */
  kind: "DoStatement";

  /** Statement. */
  statement: Statement;

  /** Expression. */
  expression: Expression;
}
