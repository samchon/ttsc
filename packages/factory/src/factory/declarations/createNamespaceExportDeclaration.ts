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
 */
export const createNamespaceExportDeclaration = (
  name: string | Identifier,
): NamespaceExportDeclaration =>
  make("NamespaceExportDeclaration", { name: asName(name) });
