import type { Block, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Block}: a `{ ... }` statement block.
 *
 * The `statements` become the body, in order. The `multiLine` flag controls how
 * the printer lays the block out: when `true` (the default here), each
 * statement sits on its own indented line between braces; when `false`, the
 * printer keeps the body compact on a single line.
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
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link Block}.
 */
export const createBlock = (
  statements: readonly Statement[],
  multiLine?: boolean,
): Block => make("Block", { statements, multiLine: multiLine ?? true });
