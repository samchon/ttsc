import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";

/**
 * A class property declaration.
 *
 * Built by {@link factory.createPropertyDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertyDeclaration {
  /** Discriminant tag; always `"PropertyDeclaration"`. */
  kind: "PropertyDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** The optional (`?`) or definite-assignment (`!`) marker, if any. */
  questionOrExclamationToken?: Token;

  /** The type. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
