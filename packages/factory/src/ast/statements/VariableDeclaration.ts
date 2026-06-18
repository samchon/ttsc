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
 */
export interface VariableDeclaration {
  /** Discriminant tag; always `"VariableDeclaration"`. */
  kind: "VariableDeclaration";

  /** The name; a {@link BindingName} allows array / object destructuring. */
  name: BindingName;

  /** The definite-assignment marker (`!`), if any. */
  exclamationToken?: Token;

  /** The type. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
