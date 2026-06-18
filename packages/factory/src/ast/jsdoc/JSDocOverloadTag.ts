import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocSignature } from "./JSDocSignature";

/**
 * An `@overload` JSDoc tag.
 *
 * Built by {@link factory.createJSDocOverloadTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocOverloadTag {
  /** Discriminant tag; always `"JSDocOverloadTag"`. */
  kind: "JSDocOverloadTag";

  /** The tag name, e.g. `overload`. */
  tagName: Identifier;

  /** The overload signature. */
  typeExpression: JSDocSignature;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
