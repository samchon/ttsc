import type { Identifier, NamespaceExport } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceExport}: the `* as ns` clause that re-exports an
 * entire module under a single namespace name.
 *
 * This node fills the `exportClause` slot of an {@link ExportDeclaration} that
 * carries a `from` specifier. The `name` accepts a raw string and is wrapped in
 * an identifier for you.
 *
 * Given the namespace name `ns`, this prints:
 *
 * ```ts
 * * as ns
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceExport}.
 */
export const createNamespaceExport = (
  name: string | Identifier,
): NamespaceExport => make("NamespaceExport", { name: asName(name) });
