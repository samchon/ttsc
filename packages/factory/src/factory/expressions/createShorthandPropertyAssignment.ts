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
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The shared property name.
 * @param objectAssignmentInitializer The default value for object
 *   destructuring, if any.
 * @returns The created {@link ShorthandPropertyAssignment}.
 */
export const createShorthandPropertyAssignment = (
  name: string | Identifier,
  objectAssignmentInitializer?: Expression,
): ShorthandPropertyAssignment =>
  make("ShorthandPropertyAssignment", {
    name: asName(name),
    objectAssignmentInitializer,
  });
