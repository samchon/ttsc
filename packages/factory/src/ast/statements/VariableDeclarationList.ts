import type { NodeFlags } from "../../syntax";
import type { VariableDeclaration } from "./VariableDeclaration";

/**
 * The declaration list inside a variable statement (`const` / `let` / `var`).
 *
 * Built by {@link factory.createVariableDeclarationList}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface VariableDeclarationList {
  /** Discriminant tag; always `"VariableDeclarationList"`. */
  kind: "VariableDeclarationList";

  /** The declarations. */
  declarations: readonly VariableDeclaration[];

  /** Whether the list is `const`, `let`, or `var`. */
  flags: NodeFlags;
}
