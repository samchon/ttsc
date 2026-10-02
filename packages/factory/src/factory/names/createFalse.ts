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
 * false
 * ```
 *
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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createFalse = (): Token => createToken(SyntaxKind.FalseKeyword);
