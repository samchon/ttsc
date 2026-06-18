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
 * a: 1;
 * ```
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
