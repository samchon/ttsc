import type { JsxTagName } from "./JsxTagName";

/**
 * The closing element of a {@link JsxElement}, e.g. `</Tag>`.
 *
 * Built by {@link factory.createJsxClosingElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxClosingElement {
  /** Discriminant tag; always `"JsxClosingElement"`. */
  kind: "JsxClosingElement";

  /** The tag name. */
  tagName: JsxTagName;
}
