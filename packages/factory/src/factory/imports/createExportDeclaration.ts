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
 * Create an {@link ExportDeclaration}: an `export { ... }` or `export *`
 * statement, with or without a `from` clause.
 *
 * The `exportClause` selects what is exported. Pass {@link NamedExports} for
 * `export { a, b }`, a {@link NamespaceExport} for `export * as ns`, or omit it
 * (undefined) for a bare `export *`. Set `isTypeOnly` to emit `export type`.
 * The `moduleSpecifier` is optional: supply it for a re-export with `from`, or
 * leave it off to export local bindings. A raw string is wrapped in a string
 * literal.
 *
 * Given named exports of `a` re-exported from `"./mod"`, this prints:
 *
 * ```ts
 * export { a } from "./mod";
 * ```
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
