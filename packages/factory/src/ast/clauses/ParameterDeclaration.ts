import type { Expression } from "../expressions/Expression";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";

/**
 * A function/method parameter declaration.
 *
 * Built by {@link factory.createParameterDeclaration}.
 *
 * This model supports identifier names, not destructuring parameters.
 * Omitted markers, annotation and initializer are absent syntax; their
 * combinations are not checked for declaration-context legality.
 *
 * @evidence contracts/common.md#principled-implementation Identifier, optional syntax markers, annotation and initializer preserve the supported parameter parts; destructuring and semantic validity are explicitly outside this shape.
 * @evidence contracts/common.md#clear-and-simple-design Each optional parameter part is a separate field rather than combined flags or hidden compiler state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional markers reflect syntax presence; no fixture-based parameter rules are encoded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc records identifier-only names and omission meaning; separated member descriptions follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ParameterDeclaration {
  /** Discriminant tag; always `"ParameterDeclaration"`. */
  kind: "ParameterDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The rest marker (`...`), if any. */
  dotDotDotToken?: Token;

  /** The name. */
  name: Identifier;

  /** The optional marker (`?`), if any. */
  questionToken?: Token;

  /** The type. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
