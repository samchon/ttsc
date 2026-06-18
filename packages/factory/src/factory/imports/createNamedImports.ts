import type { ImportSpecifier, NamedImports } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NamedImports}: the `{ ... }` binding group inside an import
 * clause.
 *
 * Each element is an {@link ImportSpecifier} naming one binding, optionally
 * aliased with `as`. This node is the `namedBindings` slot of an
 * {@link ImportClause}; on its own it prints just the brace group, and the
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
 * @returns The created {@link NamedImports}.
 */
export const createNamedImports = (
  elements: readonly ImportSpecifier[],
): NamedImports => make("NamedImports", { elements });
