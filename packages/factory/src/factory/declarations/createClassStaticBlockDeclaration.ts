import type { Block, ClassStaticBlockDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ClassStaticBlockDeclaration}: a `static { ... }` block.
 *
 * This is a class member that runs initialization code when the class is
 * evaluated. The `body` block holds the statements, which the printer indents
 * one per line after the `static` keyword.
 *
 * Given a body that assigns `count = 0`, the printed member is:
 *
 * ```ts
 * static {
 *   count = 0;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param body The body.
 * @returns The created {@link ClassStaticBlockDeclaration}.
 */
export const createClassStaticBlockDeclaration = (
  body: Block,
): ClassStaticBlockDeclaration => make("ClassStaticBlockDeclaration", { body });
