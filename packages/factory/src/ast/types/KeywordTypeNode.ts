import type { SyntaxKind } from "../../syntax";

/**
 * A keyword type, e.g. `string`, `number`, `void`.
 *
 * Built by {@link factory.createKeywordTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface KeywordTypeNode {
  /** Discriminant tag; always `"KeywordTypeNode"`. */
  kind: "KeywordTypeNode";

  /** The keyword token (e.g. `string`, `number`, `void`). */
  keyword: SyntaxKind;
}
