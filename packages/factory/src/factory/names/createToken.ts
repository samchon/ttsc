import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link Token}: a node that wraps a single {@link SyntaxKind}.
 *
 * The `token` is the syntax kind to wrap, such as a punctuation or keyword
 * kind. The printer emits the source spelling tied to that kind, so a question
 * mark token prints as `?` and a keyword token prints as its keyword. The
 * generic `TKind` flows through to the result type for type-safe consumers.
 *
 * With `token` of the question-mark kind, this prints:
 *
 * ```ts
 * ?
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param token The token.
 * @returns The created {@link Token}.
 */
export const createToken = <TKind extends SyntaxKind>(
  token: TKind,
): Token<TKind> => make("Token", { token }) as Token<TKind>;
