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

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The type. */
  type?: TypeNode;
}
