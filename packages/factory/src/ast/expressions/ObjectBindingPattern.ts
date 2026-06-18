import type { BindingElement } from "./BindingElement";

/**
 * An object destructuring pattern, e.g. `{ a, b }`.
 *
 * Built by {@link factory.createObjectBindingPattern}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ObjectBindingPattern {
  /** Discriminant tag; always `"ObjectBindingPattern"`. */
  kind: "ObjectBindingPattern";

  /** Elements. */
  elements: readonly BindingElement[];
}
