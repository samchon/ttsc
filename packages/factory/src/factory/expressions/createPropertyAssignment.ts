import type { Expression, PropertyAssignment, PropertyName } from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link PropertyAssignment}: a `name: value` member of an object
 * literal.
 *
 * `name` is the property key; a string is converted to a property name node.
 * `initializer` is the assigned value. The printer joins them with a colon and
 * a single space.
 *
 * With `name` of `a` and `initializer` of `1`, the printer emits:
 *
 * ```ts
 * a: 1
 * ```
 *
 * A string key becomes an Identifier and must be valid identifier spelling.
 * Use a StringLiteral key for arbitrary string names; values remain required
 * expression nodes rather than inferred from the name.
 *
 * @evidence contracts/common.md#principled-implementation Shared property-name normalization retains supplied name-node categories and turns strings into identifiers; the required initializer remains value syntax, with identifier validity supplied by the caller.
 * @evidence contracts/common.md#clear-and-simple-design One name adapter and make call expose key/value roles without duplicating shorthand or computed-name forms.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The initializer is explicit input instead of a guessed value from known property names or a patched object assignment.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies string-key normalization and the arbitrary-name alternative; required value documentation, fragment example and tags are separate.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The property name.
 * @param initializer The assigned value.
 * @returns The created {@link PropertyAssignment}.
 */
export const createPropertyAssignment = (
  name: string | PropertyName,
  initializer: Expression,
): PropertyAssignment =>
  make("PropertyAssignment", { name: asPropertyName(name), initializer });
