import type { Expression } from "./Expression";

/**
 * A spread element in an argument or array, e.g. `...items`.
 *
 * Built by {@link factory.createSpreadElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SpreadElement {
  /** Discriminant tag; always `"SpreadElement"`. */
  kind: "SpreadElement";

  /** The expression. */
  expression: Expression;
}
