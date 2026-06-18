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
 * string;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param kind The token kind.
 * @returns The created {@link KeywordTypeNode}.
 */
export const createKeywordTypeNode = (kind: SyntaxKind): KeywordTypeNode =>
  make("KeywordTypeNode", { keyword: kind });
