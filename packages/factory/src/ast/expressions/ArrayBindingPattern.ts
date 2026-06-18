import type { ArrayBindingElement } from "./ArrayBindingElement";

/**
 * An array destructuring pattern, e.g. `[a, b]`.
 *
 * Built by {@link factory.createArrayBindingPattern}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrayBindingPattern {
  /** Discriminant tag; always `"ArrayBindingPattern"`. */
  kind: "ArrayBindingPattern";

  /** Elements. */
  elements: readonly ArrayBindingElement[];
}
