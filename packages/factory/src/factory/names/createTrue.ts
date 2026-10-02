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
 * true
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   TrueKeyword selects the boolean-true token spelling through createToken.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The convenience names a token meaning while sharing token construction.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fixed token kind defines this API's true literal, not a fixture result.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the no-argument token contract and shows true as an expression,
 *   with descriptive prose and tags separated by a blank comment line.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createTrue = (): Token => createToken(SyntaxKind.TrueKeyword);
