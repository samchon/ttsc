import type {
  Expression,
  Identifier,
  ShorthandPropertyAssignment,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ShorthandPropertyAssignment}: an object member that reuses a
 * variable name as both key and value, like `{ a }`.
 *
 * `name` is the shared property name. `objectAssignmentInitializer` is only
 * valid when the literal is the target of a destructuring assignment; when
 * present the printer appends `=` and the default value, otherwise it emits the
 * name alone.
 *
 * With `name` of `a` and no initializer, the printer emits:
 *
 * ```ts
 * a;
 * ```
 *
 * String names must be valid identifiers. This constructor does not establish
 * that an enclosing assignment pattern makes a supplied default legal.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The shared property name.
 * @param objectAssignmentInitializer The default value for object
 *   destructuring, if any.
 * @returns The created {@link ShorthandPropertyAssignment}.
 * @evidence contracts/common.md#principled-implementation Shared name normalization retains one identifier for the key/reference role, and optional default syntax remains explicit; identifier and assignment-context validity are caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One name field avoids duplicating the same binding as separate key and value, while make stores the optional pattern default.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The value is not guessed from known property names; an explicit default serves supported assignment-pattern syntax rather than an output repair.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains shared identity, identifier spelling and default-context restrictions, with example, parameters and separate acknowledgment tags.
 */
export const createShorthandPropertyAssignment = (
  name: string | Identifier,
  objectAssignmentInitializer?: Expression,
): ShorthandPropertyAssignment =>
  make("ShorthandPropertyAssignment", {
    name: asName(name),
    objectAssignmentInitializer,
  });
