import type { BindingElement } from "./BindingElement";

/**
 * An object destructuring pattern, e.g. `{ a, b }`.
 *
 * Built by {@link factory.createObjectBindingPattern}.
 *
 * Elements declare local bindings, including source-property mappings and
 * defaults. Callers ensure that any rest binding is last and otherwise legal.
 *
 * @evidence contracts/common.md#principled-implementation Ordered BindingElement nodes represent object destructuring declarations, keeping source mapping distinct from local names; rest legality is not enforced by the array type.
 * @evidence contracts/common.md#clear-and-simple-design A single sequence composes existing binding elements while the object-pattern kind owns brace syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source mappings and rest bindings stay explicit rather than becoming invented local names or hardcoded property values.
 * @evidence contracts/common.md#meaningful-documentation Native prose states declaration roles and rest placement; the sequence member and tags are separated under the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ObjectBindingPattern {
  /** Discriminant tag; always `"ObjectBindingPattern"`. */
  kind: "ObjectBindingPattern";

  /** Object binding entries in source order, with any rest entry last. */
  elements: readonly BindingElement[];
}
