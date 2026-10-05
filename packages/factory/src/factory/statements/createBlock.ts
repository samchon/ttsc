import type { Block, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Block}: a `{ ... }` statement block.
 *
 * The `statements` become the body, in order. The `multiLine` flag defaults to
 * true and forces nonempty blocks onto indented lines. False permits a flat
 * layout when the body fits the available width; empty blocks print as `{}`.
 *
 * With `statements` printing `a()` and `b()` and `multiLine` left at its
 * default, the result is:
 *
 * ```ts
 * {
 *   a();
 *   b();
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @param multiLine Force a multiline body when true; defaults to true.
 * @returns The created {@link Block}.
 * @evidence contracts/common.md#principled-implementation
 *   Ordered statements populate Block and the nullish default makes multiline
 *   layout explicit. The printer applies the flag without changing statement order.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Statement collection stays in one block, with layout decisions in the printer.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The true default is a layout policy, not a fixture-specific output branch;
 *   false delegates width decisions to the printer rather than rewriting source.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc records the flag's layout effect and empty/nonempty behavior
 *   in a paragraph separate from the example and acknowledgment tags.
 */
export const createBlock = (
  statements: readonly Statement[],
  multiLine?: boolean,
): Block => make("Block", { statements, multiLine: multiLine ?? true });
