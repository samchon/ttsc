import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A class method declaration.
 *
 * Built by {@link factory.createMethodDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Property name, generator/optional markers, generics, parameters and optional return/body clauses retain method syntax without checking contextual modifier combinations.
 * @evidence contracts/common.md#clear-and-simple-design Each signature/body part has one named field using existing shared syntax nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Marker presence is caller syntax; no runtime method is monkey patched or replaced by consumer-specific output.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies methods and member comments explain ordered parameters, return annotation and absent implementation; spacing follows the documentation skill.
 */
export interface MethodDeclaration {
  /** Discriminant tag; always `"MethodDeclaration"`. */
  kind: "MethodDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The generator marker (`*`), if any. */
  asteriskToken?: Token;

  /** The name. */
  name: PropertyName;

  /** The optional marker (`?`), if any. */
  questionToken?: Token;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Method parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Return annotation, if explicitly supplied. */
  type?: TypeNode;

  /** Implementation block; absent for a bodyless method declaration. */
  body?: Block;
}
