import type { ExportSpecifier, NamedExports } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NamedExports}: the `{ ... }` binding group inside an export
 * declaration.
 *
 * Each element is an {@link ExportSpecifier} naming one binding, optionally
 * aliased with `as`. This node is the `exportClause` slot of an
 * {@link ExportDeclaration}; on its own it prints just the brace group, and the
 * printer adds a trailing comma when the list breaks across lines.
 *
 * Given specifiers for `a` and `b`, this prints:
 *
 * ```ts
 * { a, b }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Ordered ExportSpecifier elements preserve each binding and alias inside
 *   the export brace group, without adding a module target.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   ExportDeclaration owns from/type-only statement decisions while this group
 *   owns only the member collection, leaving separators to printing.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Binding membership is caller data rather than a patched live module export.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes standalone brace output from the enclosing declaration
 *   and explains broken-list commas before separate example and tag paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created {@link NamedExports}.
 */
export const createNamedExports = (
  elements: readonly ExportSpecifier[],
): NamedExports => make("NamedExports", { elements });
