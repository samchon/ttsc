import type { TypeNode } from "../types/TypeNode";
import type { JsxAttributes } from "./JsxAttributes";
import type { JsxTagName } from "./JsxTagName";

/**
 * A self-closing JSX element, e.g. `<Tag attr="x" />`.
 *
 * Built by {@link factory.createJsxSelfClosingElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxSelfClosingElement {
  /** Discriminant tag; always `"JsxSelfClosingElement"`. */
  kind: "JsxSelfClosingElement";

  /** The tag name. */
  tagName: JsxTagName;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];

  /** The attributes. */
  attributes: JsxAttributes;
}
