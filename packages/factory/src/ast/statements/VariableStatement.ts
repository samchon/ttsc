import type { ModifierLike } from "../names/ModifierLike";
import type { VariableDeclarationList } from "./VariableDeclarationList";

/**
 * A variable statement, e.g. `const x = 1;`.
 *
 * Built by {@link factory.createVariableStatement}.
 *
 * @evidence contracts/common.md#principled-implementation A declaration list plus optional leading modifiers preserves the statement boundary without checking contextual modifier or binding validity.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns statement placement; VariableDeclarationList owns keyword and binding sequence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied lists and modifiers introduce no consumer-name substitution or runtime mutation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates const statement syntax and identifies leading modifiers and list ownership; comments follow the documentation skill.
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
