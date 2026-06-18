import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocSignature } from "./JSDocSignature";

/**
 * A `@callback` JSDoc tag.
 *
 * Built by {@link factory.createJSDocCallbackTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocCallbackTag {
  /** Discriminant tag; always `"JSDocCallbackTag"`. */
  kind: "JSDocCallbackTag";

  /** The tag name, e.g. `callback`. */
  tagName: Identifier;

  /** The callback signature. */
  typeExpression: JSDocSignature;

  /** The full callback name, if any. */
  fullName?: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
