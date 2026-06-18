import type { ModifierLike } from "../names/ModifierLike";
import type { VariableDeclarationList } from "./VariableDeclarationList";

/**
 * A variable statement, e.g. `const x = 1;`.
 *
 * Built by {@link factory.createVariableStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface VariableStatement {
  /** Discriminant tag; always `"VariableStatement"`. */
  kind: "VariableStatement";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The declaration list. */
  declarationList: VariableDeclarationList;
}
