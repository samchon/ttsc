import type { PropertyName } from "../names/PropertyName";
import type { Expression } from "./Expression";

/**
 * A `key: value` member of an object literal.
 *
 * Built by {@link factory.createPropertyAssignment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertyAssignment {
  /** Discriminant tag; always `"PropertyAssignment"`. */
  kind: "PropertyAssignment";

  /** The name. */
  name: PropertyName;

  /** The initializer, if any. */
  initializer: Expression;
}
