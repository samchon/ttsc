import type { Identifier } from "../names/Identifier";
import type { PrivateIdentifier } from "../names/PrivateIdentifier";
import type { Expression } from "./Expression";

/**
 * A property access, e.g. `object.member`.
 *
 * Built by {@link factory.createPropertyAccessExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertyAccessExpression {
  /** Discriminant tag; always `"PropertyAccessExpression"`. */
  kind: "PropertyAccessExpression";

  /** The expression. */
  expression: Expression;

  /** The name. */
  name: Identifier | PrivateIdentifier;
}
