import type { JsxAttributeLike } from "./JsxAttributeLike";

/**
 * The `{ ... }` collection of attributes attached to a JSX opening element.
 *
 * Built by {@link factory.createJsxAttributes}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxAttributes {
  /** Discriminant tag; always `"JsxAttributes"`. */
  kind: "JsxAttributes";

  /** The attribute properties. */
  properties: readonly JsxAttributeLike[];
}
