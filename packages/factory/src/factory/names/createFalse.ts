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
 */
export const createFalse = (): Token => createToken(SyntaxKind.FalseKeyword);
