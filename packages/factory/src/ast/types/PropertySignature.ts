import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { TypeNode } from "./TypeNode";

/**
 * A property member of an interface or type literal.
 *
 * Built by {@link factory.createPropertySignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertySignature {
  /** Discriminant tag; always `"PropertySignature"`. */
  kind: "PropertySignature";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** The optional marker (`?`), if any. */
  questionToken?: Token;

  /** The type. */
  type?: TypeNode;
}
