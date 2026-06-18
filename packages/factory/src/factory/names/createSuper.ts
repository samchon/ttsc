import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create a {@link Super}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created node.
 */
export const createSuper = (): Token => createToken(SyntaxKind.SuperKeyword);
