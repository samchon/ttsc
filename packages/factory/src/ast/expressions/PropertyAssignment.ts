import type { PropertyName } from "../names/PropertyName";
import type { Expression } from "./Expression";

/**
 * A `key: value` member of an object literal.
 *
 * Built by {@link factory.createPropertyAssignment}.
 *
 * The initializer is required syntax, even when its expression denotes
 * `undefined`. Computed names retain their own key-producing expression.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A PropertyName and required value expression preserve both sides of key: value, including computed keys without evaluating them.
 * @evidence contracts/common.md#clear-and-simple-design Name and initializer directly expose the member's responsibility; shorthand and spread use their separate node forms.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Required value syntax is not inferred from a property name or replaced with an expected consumer value.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the required initializer and computed-key behavior; the initializer member explicitly identifies its required value role and tags remain separated.
 */
export interface PropertyAssignment {
  /** Discriminant tag; always `"PropertyAssignment"`. */
  kind: "PropertyAssignment";

  /** The name. */
  name: PropertyName;

  /** Required value expression following the colon. */
  initializer: Expression;
}
