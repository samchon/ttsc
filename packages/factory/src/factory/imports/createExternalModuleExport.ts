import type { ExportDeclaration, Identifier } from "../../ast";
import { createExportDeclaration } from "./createExportDeclaration";
import { createExportSpecifier } from "./createExportSpecifier";
import { createNamedExports } from "./createNamedExports";

/**
 * Create an `export { name }` statement that exports a single local binding.
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
 * @evidence contracts/common.md#principled-implementation
 *   One unaliased value ExportSpecifier inside NamedExports with no module target
 *   represents a local export; this operation does not invent a from specifier.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Composition uses the existing specifier, group and declaration builders so
 *   alias/type-only/module policies have their original owners.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The single-binding list is the explicit API meaning, not a fixture module.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose describes the unaliased local export and absent from clause,
 *   with a separate printed example and acknowledgment block.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param exportName The local binding to expose under its existing name.
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
