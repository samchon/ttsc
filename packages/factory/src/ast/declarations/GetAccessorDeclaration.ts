import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";

/**
 * A class getter declaration.
 *
 * Built by {@link factory.createGetAccessorDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Name, modifiers, parameters and optional annotation/body preserve getter syntax; the broad parameter list does not enforce zero getter parameters.
 * @evidence contracts/common.md#clear-and-simple-design Getter header and body parts are explicit fields sharing property-name, parameter and type nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign property getter is replaced; the node retains caller-supplied syntax.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies getter declarations and member comments distinguish return annotation and bodyless form; native spacing follows the documentation skill.
 */
export interface GetAccessorDeclaration {
  /** Discriminant tag; always `"GetAccessorDeclaration"`. */
  kind: "GetAccessorDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** Printed parameter list; a valid getter normally supplies none. */
  parameters: readonly ParameterDeclaration[];

  /** Getter return annotation, if supplied. */
  type?: TypeNode;

  /** Getter implementation; absent for a bodyless accessor declaration. */
  body?: Block;
}
