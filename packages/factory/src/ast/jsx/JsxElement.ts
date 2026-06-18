import type { JsxChild } from "./JsxChild";
import type { JsxClosingElement } from "./JsxClosingElement";
import type { JsxOpeningElement } from "./JsxOpeningElement";

/**
 * A paired JSX element, e.g. `<Tag>children</Tag>`.
 *
 * Built by {@link factory.createJsxElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxElement {
  /** Discriminant tag; always `"JsxElement"`. */
  kind: "JsxElement";

  /** The opening element. */
  openingElement: JsxOpeningElement;

  /** The children. */
  children: readonly JsxChild[];

  /** The closing element. */
  closingElement: JsxClosingElement;
}
