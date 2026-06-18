import type { Block } from "./Block";
import type { VariableDeclaration } from "./VariableDeclaration";

/**
 * The `catch` clause of a `try` statement.
 *
 * Built by {@link factory.createCatchClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CatchClause {
  /** Discriminant tag; always `"CatchClause"`. */
  kind: "CatchClause";

  /** VariableDeclaration. */
  variableDeclaration?: VariableDeclaration;

  /** Block. */
  block: Block;
}
