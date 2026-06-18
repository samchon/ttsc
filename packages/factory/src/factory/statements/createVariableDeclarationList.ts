import type { VariableDeclaration, VariableDeclarationList } from "../../ast";
import { NodeFlags } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link VariableDeclarationList}: the `const x = 1` group.
 *
 * The `declarations` are the comma-separated declarators, and `flags` chooses
 * the keyword the printer emits: `const`, `let`, or plain `var` when no flag is
 * set. This is the keyword-bearing part shared by a {@link VariableStatement}
 * and by `for` loop headers.
 *
 * The list carries no trailing semicolon on its own. With a single declaration
 * of `x = 1` and the `const` flag, it prints as:
 *
 * ```ts
 * const x = 1;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param declarations The declarations.
 * @param flags The declaration flags (`const` / `let` / `var`).
 * @returns The created {@link VariableDeclarationList}.
 */
export const createVariableDeclarationList = (
  declarations: readonly VariableDeclaration[],
  flags: NodeFlags = NodeFlags.None,
): VariableDeclarationList =>
  make("VariableDeclarationList", { declarations, flags });
