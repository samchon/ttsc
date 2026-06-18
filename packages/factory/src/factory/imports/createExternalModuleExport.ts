import type { ExportDeclaration, Identifier } from "../../ast";
import { createExportDeclaration } from "./createExportDeclaration";
import { createExportSpecifier } from "./createExportSpecifier";
import { createNamedExports } from "./createNamedExports";

/**
 * Convenience wrapper that builds the corresponding expression node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param exportName The exportName.
 * @returns The created expression.
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
