import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create the `null` keyword as a {@link Token}.
 *
 * This takes no arguments and wraps the `NullKeyword` syntax kind. The printer
 * emits the keyword as the `null` literal.
 *
 * This prints:
 *
 * ```ts
 * null;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createNull = (): Token => createToken(SyntaxKind.NullKeyword);
