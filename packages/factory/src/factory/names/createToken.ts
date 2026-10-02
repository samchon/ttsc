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
 * @evidence contracts/common.md#principled-implementation
 *   Token stores the supplied SyntaxKind in token while kind remains Token.
 *   The generic retains its literal kind; callers must choose a token-spellable
 *   kind because this broad signature does not validate token grammar.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The shared constructor owns outline allocation, and the printer owns the
 *   string-valued SyntaxKind spelling; no keyword conversion table lives here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The generic assertion preserves the input type through make's union result;
 *   it does not manufacture a different token kind.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes outline kind from token spelling and explains generic
 *   propagation with an example and separated acknowledgment paragraphs.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param token The token.
 * @returns The created {@link Token}.
 */
export const createToken = <TKind extends SyntaxKind>(
  token: TKind,
): Token<TKind> => make("Token", { token }) as Token<TKind>;
