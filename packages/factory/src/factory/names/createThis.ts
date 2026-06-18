import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create the `this` keyword as a {@link Token}.
 *
 * This takes no arguments and wraps the `ThisKeyword` syntax kind. The printer
 * emits the keyword as the `this` expression.
 *
 * This prints:
 *
 * ```ts
 * this;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createThis = (): Token => createToken(SyntaxKind.ThisKeyword);
