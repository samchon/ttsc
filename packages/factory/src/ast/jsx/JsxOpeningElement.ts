import type { TypeNode } from "../types/TypeNode";
import type { JsxAttributes } from "./JsxAttributes";
import type { JsxTagName } from "./JsxTagName";

/**
 * The opening element of a {@link JsxElement}, e.g. `<Tag attr="x">`.
 *
 * Built by {@link factory.createJsxOpeningElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxOpeningElement {
  /** Discriminant tag; always `"JsxOpeningElement"`. */
  kind: "JsxOpeningElement";

  /** The tag name. */
  tagName: JsxTagName;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];

  /** The attributes. */
  attributes: JsxAttributes;
}
