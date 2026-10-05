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
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceExportDeclaration}.
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
 */
export const createNamespaceExportDeclaration = (
  name: string | Identifier,
): NamespaceExportDeclaration =>
  make("NamespaceExportDeclaration", { name: asName(name) });
