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
 * @evidence contracts/common.md#principled-implementation Property name, optional marker/annotation/initializer and modifiers preserve class-field syntax; the broad token and name shapes do not enforce contextual validity.
 * @evidence contracts/common.md#clear-and-simple-design A single marker field represents mutually selected ? or ! syntax, separate from annotation and initialization.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Field syntax is supplied data; this interface performs no foreign property mutation or special consumer initialization.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies class fields and documents optional/definite marker and absent annotation; native spacing follows the documentation skill.
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

  /** Field annotation, if explicitly supplied. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
