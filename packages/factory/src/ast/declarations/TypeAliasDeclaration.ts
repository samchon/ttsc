import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A type alias declaration.
 *
 * Built by {@link factory.createTypeAliasDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation Identifier, optional generics/modifiers and required TypeNode preserve named alias syntax without resolving cycles or computing its represented type.
 * @evidence contracts/common.md#clear-and-simple-design Alias header and target type are separate fields using shared declaration/type nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names and target types are supplied syntax rather than fixture-specific alias substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies a type alias and describes its target type and optional generics; member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeAliasDeclaration {
  /** Discriminant tag; always `"TypeAliasDeclaration"`. */
  kind: "TypeAliasDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Target type after the equals sign. */
  type: TypeNode;
}
