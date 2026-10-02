import type { Identifier, NamespaceExportDeclaration } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceExportDeclaration}: an `export as namespace X;`.
 *
 * This is the UMD global declaration used in `.d.ts` files to state the global
 * variable name under which the module is exposed in a script context. The
 * `name` is that global identifier.
 *
 * Given the name `App`, the printed declaration is:
 *
 * ```ts
 * export as namespace App;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   A normalized Identifier supplies the UMD global name for export-as-namespace
 *   syntax; it does not construct the module's runtime namespace object.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One name models this declaration; actual module exports have other node kinds.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The global declaration is explicit source input, not a global runtime patch.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains .d.ts/UMD usage and the exposed global name with a separate
 *   declaration example and blank comment lines before acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceExportDeclaration}.
 */
export const createNamespaceExportDeclaration = (
  name: string | Identifier,
): NamespaceExportDeclaration =>
  make("NamespaceExportDeclaration", { name: asName(name) });
