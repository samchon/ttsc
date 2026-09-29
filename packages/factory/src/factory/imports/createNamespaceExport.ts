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
 * @evidence contracts/common.md#principled-implementation
 *   The normalized identifier is the exported namespace name; the node models
 *   * as name and requires an enclosing export with a module target.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Namespace name and export-statement target remain separate responsibilities,
 *   sharing identifier normalization without a second export implementation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The namespace is represented as source syntax rather than foreign mutations.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states the required enclosing from clause and string-name convenience,
 *   with an example and blank comment lines before acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceExport}.
 */
export const createNamespaceExport = (
  name: string | Identifier,
): NamespaceExport => make("NamespaceExport", { name: asName(name) });
