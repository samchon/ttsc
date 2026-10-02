import type { ArrayBindingElement } from "./ArrayBindingElement";

/**
 * An array destructuring pattern, e.g. `[a, b]`.
 *
 * Built by {@link factory.createArrayBindingPattern}.
 *
 * Elements retain positional order, including holes. A rest binding must
 * occupy a grammar-valid position; the array type does not enforce this.
 *
 * @evidence contracts/common.md#principled-implementation An ordered binding-or-hole list represents destructuring positions; the discriminant selects bracketed pattern printing, not a value array.
 * @evidence contracts/common.md#clear-and-simple-design One element sequence holds the pattern; each nested BindingElement owns its local name and default.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Skipped bindings use OmittedExpression rather than invented variable names or expected output text.
 * @evidence contracts/common.md#meaningful-documentation Prose and member documentation explain ordering, holes and caller-owned rest placement; blank lines separate members and acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrayBindingPattern {
  /** Discriminant tag; always `"ArrayBindingPattern"`. */
  kind: "ArrayBindingPattern";

  /** Bindings and holes in their original positional order. */
  elements: readonly ArrayBindingElement[];
}
