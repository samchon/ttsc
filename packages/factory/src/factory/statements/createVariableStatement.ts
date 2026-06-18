import type {
  ModifierLike,
  VariableDeclaration,
  VariableDeclarationList,
  VariableStatement,
} from "../../ast";
import { make } from "../internal/make";
import { createVariableDeclarationList } from "./createVariableDeclarationList";

/**
 * Create a {@link VariableStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param declarationList The declaration list.
 * @returns The created {@link VariableStatement}.
 */
export const createVariableStatement = (
  modifiers: readonly ModifierLike[] | undefined,
  declarationList: VariableDeclarationList | readonly VariableDeclaration[],
): VariableStatement =>
  make("VariableStatement", {
    modifiers,
    declarationList: Array.isArray(declarationList)
      ? createVariableDeclarationList(
          declarationList as readonly VariableDeclaration[],
        )
      : (declarationList as VariableDeclarationList),
  });
