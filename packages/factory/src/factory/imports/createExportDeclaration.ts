import type {
  ExportDeclaration,
  Expression,
  ModifierLike,
  NamedExports,
  NamespaceExport,
} from "../../ast";
import { make } from "../internal/make";
import { createStringLiteral } from "../literals/createStringLiteral";

/**
 * Create a {@link ExportDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param isTypeOnly Whether this is a type-only import/export.
 * @param exportClause The export clause; omitted for `export *`.
 * @param moduleSpecifier The module specifier (the `from` target).
 * @returns The created {@link ExportDeclaration}.
 */
export const createExportDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  isTypeOnly: boolean,
  exportClause: NamedExports | NamespaceExport | undefined,
  moduleSpecifier?: Expression | string,
): ExportDeclaration =>
  make("ExportDeclaration", {
    modifiers,
    isTypeOnly,
    exportClause,
    moduleSpecifier:
      typeof moduleSpecifier === "string"
        ? createStringLiteral(moduleSpecifier)
        : moduleSpecifier,
  });
