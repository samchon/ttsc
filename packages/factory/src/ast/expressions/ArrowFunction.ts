import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";
import type { Expression } from "./Expression";

/**
 * An arrow function expression.
 *
 * Built by {@link factory.createArrowFunction}.
 *
 * A block body contains statements; an expression body is concise syntax.
 * Missing return type leaves the annotation absent rather than adding `void`.
 * Callers supply parameter and modifier combinations valid in their context.
 *
 * @evidence contracts/common.md#principled-implementation The Block-or-Expression body distinction preserves statement and concise forms; optional type fields represent absent annotations, not inferred types.
 * @evidence contracts/common.md#clear-and-simple-design Signature components and the body are direct members; rendering and parameter validity stay outside this syntax container.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The ArrowFunction discriminant identifies arrow syntax without synthesizing a function declaration or a consumer-selected return type.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes body alternatives and absent return annotations; member comments and tags are separated following the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrowFunction {
  /** Discriminant tag; always `"ArrowFunction"`. */
  kind: "ArrowFunction";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** Explicit return annotation; absent means no annotation is printed. */
  type?: TypeNode;

  /** Statement block or concise expression evaluated as the return value. */
  body: Block | Expression;
}
