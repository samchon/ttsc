import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create a modifier {@link Token}: a keyword token such as `readonly` or
 * `export` used in a modifier position.
 *
 * The `kind` is the keyword syntax kind to wrap. This forwards straight to
 * {@link createToken}, so the result is a plain token whose source spelling the
 * printer emits. The name documents intent, there is no extra modifier-specific
 * behavior.
 *
 * With `kind` of the `readonly` keyword, this prints:
 *
 * ```ts
 * readonly;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param kind The token kind.
 * @returns The created {@link Token}.
 * @evidence contracts/common.md#principled-implementation
 *   Delegation retains the chosen SyntaxKind as a token; modifier-position
 *   validity is the caller's responsibility under the broad kind signature.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The API names modifier intent but shares createToken's representation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No modifier policy is patched into the printer or caller's declaration.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native documentation explicitly states the absence of extra modifier
 *   behavior and supplies readonly as a separate example before tags.
 */
export const createModifier = <TKind extends SyntaxKind>(
  kind: TKind,
): Token<TKind> => createToken(kind);
