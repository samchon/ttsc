import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { Token } from "../names/Token";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A function declaration.
 *
 * Built by {@link factory.createFunctionDeclaration}.
 *
 * A missing name represents an anonymous default-export declaration. A
 * missing body represents a signature; legality depends on its context.
 *
 * @evidence contracts/common.md#principled-implementation Generator presence, optional name/generics/annotation/body and ordered parameters preserve declaration clauses without claiming legal contextual combinations.
 * @evidence contracts/common.md#clear-and-simple-design One field owns each header or body part using shared parameter, type and block nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The generator marker and omitted body are syntax distinctions, not runtime function patches or test-specific execution paths.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains anonymous declarations and absent bodies, with separately documented return and parameter roles following the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface FunctionDeclaration {
  /** Discriminant tag; always `"FunctionDeclaration"`. */
  kind: "FunctionDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The generator marker (`*`), if any. */
  asteriskToken?: Token;

  /** Declared identifier; absent for an anonymous default-export function. */
  name?: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Return annotation, if explicitly supplied. */
  type?: TypeNode;

  /** Implementation block; omitted for a bodyless signature. */
  body?: Block;
}
