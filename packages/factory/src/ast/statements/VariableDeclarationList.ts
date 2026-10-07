import type { NodeFlags } from "../../syntax";
import type { VariableDeclaration } from "./VariableDeclaration";

/**
 * The declaration list inside a variable statement (`const` / `let` / `var`).
 *
 * Built by {@link factory.createVariableDeclarationList}.
 *
 * NodeFlags is broader than variable-list flags. Callers choose the intended
 * var, let or const form; this shape does not validate arbitrary flag values.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Ordered bindings and declaration flags preserve variable-list spelling; broad NodeFlags does not assert that every flag combination denotes a valid list.
 * @evidence contracts/common.md#clear-and-simple-design One list owns declaration order and keyword selection, while individual bindings own their payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Declaration flags are syntax values rather than fixture-specific variable policies.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains keyword selection and broad flags limitation; separate paragraphs follow the documentation skill.
 */
export interface VariableDeclarationList {
  /** Discriminant tag; always `"VariableDeclarationList"`. */
  kind: "VariableDeclarationList";

  /** The declarations. */
  declarations: readonly VariableDeclaration[];

  /** Whether the list is `const`, `let`, or `var`. */
  flags: NodeFlags;
}
