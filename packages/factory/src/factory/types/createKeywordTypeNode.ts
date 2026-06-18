import type { KeywordTypeNode } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link KeywordTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param kind The token kind.
 * @returns The created {@link KeywordTypeNode}.
 */
export const createKeywordTypeNode = (kind: SyntaxKind): KeywordTypeNode =>
  make("KeywordTypeNode", { keyword: kind });
