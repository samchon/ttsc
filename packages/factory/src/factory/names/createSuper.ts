import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create the `super` keyword as a {@link Token}.
 *
 * This takes no arguments and wraps the `SuperKeyword` syntax kind. The printer
 * emits the keyword as the `super` expression.
 *
 * This prints:
 *
 * ```ts
 * super
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created node.
 * @evidence contracts/common.md#principled-implementation
 *   SuperKeyword is the outline token the printer maps to super; valid usage
 *   still requires the caller to place it in a permitted class context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Super-specific meaning is one kind argument to the shared token builder.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   This emits syntax and does not alter prototypes to emulate super behavior.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc describes the no-input keyword builder and shows its source form;
 *   prose, example and tags have separate paragraphs.
 */
export const createSuper = (): Token => createToken(SyntaxKind.SuperKeyword);
