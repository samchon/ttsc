import type { Block } from "./Block";
import type { VariableDeclaration } from "./VariableDeclaration";

/**
 * The `catch` clause of a `try` statement.
 *
 * Built by {@link factory.createCatchClause}.
 *
 * @evidence contracts/common.md#principled-implementation Optional binding and required Block preserve catch syntax with or without an error variable; broad VariableDeclaration does not enforce catch-binding grammar.
 * @evidence contracts/common.md#clear-and-simple-design Binding presence and handler body are separate fields using existing declaration/block nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is handler syntax, not a production exception-swallowing workaround or foreign runtime patch.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies catch context and omitted binding meaning; member paragraphs follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CatchClause {
  /** Discriminant tag; always `"CatchClause"`. */
  kind: "CatchClause";

  /** Error binding; omitted for catch without a parenthesized binding. */
  variableDeclaration?: VariableDeclaration;

  /** Statements of the catch handler. */
  block: Block;
}
