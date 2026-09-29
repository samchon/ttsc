import type { Identifier } from "../names/Identifier";
import type { Expression } from "./Expression";

/**
 * A shorthand object-literal member, e.g. `{ x }`.
 *
 * Built by {@link factory.createShorthandPropertyAssignment}.
 *
 * The identifier supplies both the property name and its referenced value.
 * A default initializer is for a destructuring assignment context, not an
 * ordinary object-literal value; callers supply the correct enclosing context.
 *
 * @evidence contracts/common.md#principled-implementation One Identifier preserves the shared key/reference role of shorthand syntax; an optional default records assignment-pattern syntax whose contextual validity remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design The shared name avoids duplicating a property key and value expression that must identify the same binding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Shorthand refers to the supplied identifier instead of guessing a property value; defaults remain explicit supported pattern syntax.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains shared identity and the initializer's restricted context; separately documented members and tags follow documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ShorthandPropertyAssignment {
  /** Discriminant tag; always `"ShorthandPropertyAssignment"`. */
  kind: "ShorthandPropertyAssignment";

  /** The name. */
  name: Identifier;

  /** The default value for object destructuring, if any. */
  objectAssignmentInitializer?: Expression;
}
