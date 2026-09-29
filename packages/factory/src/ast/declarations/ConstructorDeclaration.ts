import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { Block } from "../statements/Block";

/**
 * A class constructor declaration.
 *
 * Built by {@link factory.createConstructorDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered parameters, optional modifiers and optional body preserve constructor declarations, including bodyless signatures; contextual constructor validity remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design The constructor owns signature/body presence while shared parameter and block nodes own detail.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No runtime constructor is replaced; this shape retains caller syntax parts.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies constructor use and explains bodyless signature and parameter order; member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConstructorDeclaration {
  /** Discriminant tag; always `"ConstructorDeclaration"`. */
  kind: "ConstructorDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** Constructor parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Implementation block; absent for a bodyless constructor signature. */
  body?: Block;
}
