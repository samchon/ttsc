import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create the `false` keyword as a {@link Token}.
 *
 * This takes no arguments and wraps the `FalseKeyword` syntax kind. The printer
 * emits the keyword as the boolean literal `false`.
 *
 * This prints:
 *
 * ```ts
 * false;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 * @evidence contracts/common.md#principled-implementation
 *   FalseKeyword is the printer's boolean-false token kind; createToken carries
 *   that kind rather than treating false as an identifier spelling.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A named convenience delegates token construction instead of owning state.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   FalseKeyword is the syntax discriminant required by this zero-input API.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies the false keyword and printed literal, separated
 *   from tags under the documentation skill's paragraph guidance.
 */
export const createFalse = (): Token => createToken(SyntaxKind.FalseKeyword);
