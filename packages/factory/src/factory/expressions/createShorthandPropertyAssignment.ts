import type {
  Expression,
  Identifier,
  ShorthandPropertyAssignment,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ShorthandPropertyAssignment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
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
