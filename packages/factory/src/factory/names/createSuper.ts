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
 */
export const createSuper = (): Token => createToken(SyntaxKind.SuperKeyword);
