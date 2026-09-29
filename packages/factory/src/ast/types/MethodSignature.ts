import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A method member of an interface or type literal.
 *
 * Built by {@link factory.createMethodSignature}.
 *
 * @evidence contracts/common.md#principled-implementation The property name, optional marker, generics, ordered parameters and return annotation preserve a method member's syntax without checking name/context legality.
 * @evidence contracts/common.md#clear-and-simple-design Each signature clause has one field using shared name, parameter and type nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Name and signature parts are caller data, with no hardcoded method names or callable outcomes.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies interface/type-literal use and distinguishes return annotation and argument order; separated comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface MethodSignature {
  /** Discriminant tag; always `"MethodSignature"`. */
  kind: "MethodSignature";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** The optional marker (`?`), if any. */
  questionToken?: Token;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Method parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Return annotation, if the signature supplies one. */
  type?: TypeNode;
}
