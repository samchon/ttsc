import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@readonly` JSDoc tag.
 *
 * Built by {@link factory.createJSDocReadonlyTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocReadonlyTag {
  /** Discriminant tag; always `"JSDocReadonlyTag"`. */
  kind: "JSDocReadonlyTag";

  /** The tag name, e.g. `readonly`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
