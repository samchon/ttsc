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
 * @evidence contracts/common.md#principled-implementation
 *   Array.isArray distinguishes plain declarators from a VariableDeclarationList;
 *   arrays receive the list builder's var default, while supplied lists keep flags.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The statement adds modifiers/termination and delegates keyword/list ownership
 *   to createVariableDeclarationList rather than repeating flag selection.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The array union is narrowed by its real runtime representation; callers
 *   choose const/let explicitly instead of name-dependent defaults.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains array normalization, var defaults and semicolon ownership,
 *   with an explicit-list example separated from acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
