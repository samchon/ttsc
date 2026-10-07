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
 * @evidence contracts/common.md#principled-implementation
 *   NamedImports retains ImportSpecifier order as the brace-group contents;
 *   each specifier keeps its own alias and type-only meaning.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The group owns collection, ImportClause owns placement and the printer
 *   owns braces, separators and line-breaking.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Supplied bindings are neither resolved nor substituted from a target module.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose describes the owning clause slot and standalone brace output,
 *   with layout behavior, example and acknowledgment tags visibly separated.
 */
export const createNamedImports = (
  elements: readonly ImportSpecifier[],
): NamedImports => make("NamedImports", { elements });
