import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { Token } from "../names/Token";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A function expression.
 *
 * Built by {@link factory.createFunctionExpression}.
 *
 * An absent name creates anonymous function syntax. The generator marker and
 * return annotation are optional; their compatibility with parameters and
 * the surrounding context is not checked by this representation.
 *
 * @evidence contracts/common.md#principled-implementation Optional name and generator marker distinguish anonymous, named and generator forms, while a required Block preserves the statement-body form of a function expression; context legality remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design Signature constituents and one block are direct members, with no execution state or duplicate declaration representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Anonymous functions remain unnamed; the generator marker records supplied syntax rather than patching function behavior.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains optional identity and generator context, while members describe annotation omission and block ownership with documentation-compliant separation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface FunctionExpression {
  /** Discriminant tag; always `"FunctionExpression"`. */
  kind: "FunctionExpression";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The generator marker (`*`), if any. */
  asteriskToken?: Token;

  /** Local name; absent represents an anonymous function. */
  name?: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** Explicit return annotation; absent prints no return annotation. */
  type?: TypeNode;

  /** Required statement body, unlike an arrow's possible concise expression. */
  body: Block;
}
