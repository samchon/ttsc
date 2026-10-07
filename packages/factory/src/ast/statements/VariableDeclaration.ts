import type { BindingName } from "../expressions/BindingName";
import type { Expression } from "../expressions/Expression";
import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";

/**
 * A single binding inside a variable declaration list.
 *
 * Built by {@link factory.createVariableDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation BindingName permits identifiers and destructuring with optional assignment marker, type and initializer; those broad combinations are not semantic declaration validation.
 * @evidence contracts/common.md#clear-and-simple-design Name, marker, annotation and initializer each have one field using shared syntax nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Bindings and values come from callers, without fixture-specific variable substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies a declaration-list binding and documents destructuring and omitted clauses; member spacing follows the documentation skill.
 */
export interface VariableDeclaration {
  /** Discriminant tag; always `"VariableDeclaration"`. */
  kind: "VariableDeclaration";

  /** The name; a {@link BindingName} allows array / object destructuring. */
  name: BindingName;

  /** The definite-assignment marker (`!`), if any. */
  exclamationToken?: Token;

  /** Variable annotation, if explicitly supplied. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
