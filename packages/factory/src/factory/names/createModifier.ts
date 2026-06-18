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
 */
export const createModifier = <TKind extends SyntaxKind>(
  kind: TKind,
): Token<TKind> => createToken(kind);
