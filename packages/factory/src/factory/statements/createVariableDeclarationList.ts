import type { VariableDeclaration, VariableDeclarationList } from "../../ast";
import { NodeFlags } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link VariableDeclarationList}.
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
