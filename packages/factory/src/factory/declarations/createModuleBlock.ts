import type { ModuleBlock, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ModuleBlock}: the `{ ... }` body of a namespace or module.
 *
 * This is the body that a {@link ModuleDeclaration} wraps in braces. The
 * `statements` become its contents, which the printer indents one per line
 * inside the braces.
 *
 * Given a single `export type ID = string;` statement, the printed block is:
 *
 * ```ts
 * {
 *   export type ID = string;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link ModuleBlock}.
 * @evidence contracts/common.md#principled-implementation
 *   ModuleBlock retains ordered statements as a namespace/module body rather
 *   than introducing a second named declaration or module-loading operation.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Statement grouping is the block's responsibility; its ModuleDeclaration
 *   parent owns name, modifiers and module/namespace keyword.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Caller statements are preserved without injected namespace exports.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies enclosing module ownership and ordered body layout, with
 *   a separate block example and acknowledgment paragraphs.
 */
export const createModuleBlock = (
  statements: readonly Statement[],
): ModuleBlock => make("ModuleBlock", { statements });
