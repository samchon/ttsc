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
 * this
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   ThisKeyword preserves this as an expression token rather than an identifier
 *   named this; binding meaning belongs to the surrounding source context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The builder selects the keyword; createToken owns the shared representation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No runtime receiver is captured or replaced to produce this syntax.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose describes the token and expression spelling, with a separate
 *   example and acknowledgment block following documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link Token}.
 */
export const createThis = (): Token => createToken(SyntaxKind.ThisKeyword);
