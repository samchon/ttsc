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
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created {@link NamedExports}.
 */
export const createNamedExports = (
  elements: readonly ExportSpecifier[],
): NamedExports => make("NamedExports", { elements });
