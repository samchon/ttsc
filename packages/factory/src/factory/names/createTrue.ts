import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create the `true` keyword as a {@link Token}.
 *
 * This takes no arguments and wraps the `TrueKeyword` syntax kind. The printer
 * emits the keyword as the boolean literal `true`.
 *
 * This prints:
 *
 * ```ts
 * true;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createTrue = (): Token => createToken(SyntaxKind.TrueKeyword);
