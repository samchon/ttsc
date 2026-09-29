import type { KeywordTypeNode } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link KeywordTypeNode}: a built-in keyword type such as `string` or
 * `number`.
 *
 * The kind is a keyword {@link SyntaxKind} like `StringKeyword`,
 * `NumberKeyword`, `BooleanKeyword`, `VoidKeyword`, `AnyKeyword`, or
 * `UnknownKeyword`. The printer emits the keyword's own source text directly,
 * so the node renders as that single word with no surrounding tokens.
 *
 * Given the `StringKeyword` kind, the printer renders:
 *
 * ```ts
 * string
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The SyntaxKind argument is stored as the keyword field of KeywordTypeNode;
 *   its broad enum type does not establish that every supplied token is a type keyword.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The discriminant separates keyword types from expression tokens without a
 *   second keyword table or token spelling conversion.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Caller tokens are not replaced by a preferred string type to force valid
 *   output; grammar-appropriate keyword selection remains the caller's obligation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc describes keyword types and gives a string example; this
 *   acknowledgment states the broad enum's validation limit explicitly.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param kind The token kind.
 * @returns The created {@link KeywordTypeNode}.
 */
export const createKeywordTypeNode = (kind: SyntaxKind): KeywordTypeNode =>
  make("KeywordTypeNode", { keyword: kind });
