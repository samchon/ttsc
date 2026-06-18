import type { Expression } from "./Expression";

/**
 * A computed member name, e.g. `[Symbol.iterator]`.
 *
 * Built by {@link factory.createComputedPropertyName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ComputedPropertyName {
  /** Discriminant tag; always `"ComputedPropertyName"`. */
  kind: "ComputedPropertyName";

  /** Expression. */
  expression: Expression;
}
