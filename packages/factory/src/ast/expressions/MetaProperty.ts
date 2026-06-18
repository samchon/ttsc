import type { SyntaxKind } from "../../syntax";
import type { Identifier } from "../names/Identifier";

/**
 * A meta-property, e.g. `import.meta` or `new.target`.
 *
 * Built by {@link factory.createMetaProperty}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface MetaProperty {
  /** Discriminant tag; always `"MetaProperty"`. */
  kind: "MetaProperty";

  /** KeywordToken. */
  keywordToken: SyntaxKind;

  /** Name. */
  name: Identifier;
}
