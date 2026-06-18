import type { ExportDeclaration, Identifier } from "../../ast";
import { createExportDeclaration } from "./createExportDeclaration";
import { createExportSpecifier } from "./createExportSpecifier";
import { createNamedExports } from "./createNamedExports";

/**
 * Create an `export { name }` statement that re-exports a single local binding.
 *
 * This is a convenience wrapper that builds an {@link ExportDeclaration} whose
 * clause is a {@link NamedExports} holding one unaliased {@link ExportSpecifier}
 * for `exportName`, with no `from` specifier. The name accepts a raw string and
 * is wrapped in an identifier for you.
 *
 * Given the export name `foo`, this prints:
 *
 * ```ts
 * export { foo };
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param exportName The exportName.
 * @returns The created {@link ExportDeclaration}.
 */
export const createExternalModuleExport = (
  exportName: string | Identifier,
): ExportDeclaration =>
  createExportDeclaration(
    undefined,
    false,
    createNamedExports([createExportSpecifier(false, undefined, exportName)]),
    undefined,
  );
