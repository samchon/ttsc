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
 * null
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   NullKeyword maps to the printer's null literal; token construction retains
 *   the syntax kind instead of inferring it from an identifier string.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One delegation supplies the literal-specific convenience without state.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The constant kind is the declared null token contract.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes the keyword token from a nullable value and gives a
 *   printed example in its own paragraph before separated tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createNull = (): Token => createToken(SyntaxKind.NullKeyword);
