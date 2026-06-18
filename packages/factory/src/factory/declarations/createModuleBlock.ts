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
 */
export const createModuleBlock = (
  statements: readonly Statement[],
): ModuleBlock => make("ModuleBlock", { statements });
