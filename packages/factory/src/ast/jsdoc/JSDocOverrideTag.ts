import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@override` JSDoc tag.
 *
 * Built by {@link factory.createJSDocOverrideTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocOverrideTag {
  /** Discriminant tag; always `"JSDocOverrideTag"`. */
  kind: "JSDocOverrideTag";

  /** The tag name, e.g. `override`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
