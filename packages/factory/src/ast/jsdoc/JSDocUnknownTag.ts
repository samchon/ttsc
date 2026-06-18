import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An otherwise-unrecognized JSDoc tag, e.g. `@customTag`.
 *
 * Built by {@link factory.createJSDocUnknownTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocUnknownTag {
  /** Discriminant tag; always `"JSDocUnknownTag"`. */
  kind: "JSDocUnknownTag";

  /** The tag name. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
