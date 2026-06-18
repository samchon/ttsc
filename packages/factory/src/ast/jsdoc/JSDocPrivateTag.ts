import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@private` JSDoc tag.
 *
 * Built by {@link factory.createJSDocPrivateTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocPrivateTag {
  /** Discriminant tag; always `"JSDocPrivateTag"`. */
  kind: "JSDocPrivateTag";

  /** The tag name, e.g. `private`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
