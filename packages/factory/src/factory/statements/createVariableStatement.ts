import type {
  ModifierLike,
  VariableDeclaration,
  VariableDeclarationList,
  VariableStatement,
} from "../../ast";
import { make } from "../internal/make";
import { createVariableDeclarationList } from "./createVariableDeclarationList";

/**
 * Create a {@link VariableStatement}: a full `const x = 1;` statement.
 *
 * The optional `modifiers` are leading keywords such as `export` or `declare`.
 * The `declarationList` carries the keyword and declarators; pass a
 * {@link VariableDeclarationList} directly, or pass a plain array of
 * declarations and it is wrapped into a list for you (defaulting to `var`, so
 * build the list yourself when you need `const` or `let`).
 *
 * This is the statement-level wrapper that adds the trailing semicolon. With no
 * modifiers and a `const` declaration list of `x = 1`, the result is:
 *
 * ```ts
 * const x = 1;
 * ```
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
