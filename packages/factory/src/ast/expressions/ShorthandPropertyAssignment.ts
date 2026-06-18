import type { Identifier } from "../names/Identifier";
import type { Expression } from "./Expression";

/**
 * A shorthand object-literal member, e.g. `{ x }`.
 *
 * Built by {@link factory.createShorthandPropertyAssignment}.
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
