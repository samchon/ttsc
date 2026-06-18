import type {
  Expression,
  ImportClause,
  ImportDeclaration,
  ModifierLike,
} from "../../ast";
import { make } from "../internal/make";
import { createStringLiteral } from "../literals/createStringLiteral";

/**
 * Create a {@link ImportDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param importClause The import clause; omitted for a side-effect-only import.
 * @param moduleSpecifier The module specifier (the `from` target).
 * @returns The created {@link ImportDeclaration}.
 */
export const createImportDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  importClause: ImportClause | undefined,
  moduleSpecifier: Expression | string,
): ImportDeclaration =>
  make("ImportDeclaration", {
    modifiers,
    importClause,
    moduleSpecifier:
      typeof moduleSpecifier === "string"
        ? createStringLiteral(moduleSpecifier)
        : moduleSpecifier,
  });
