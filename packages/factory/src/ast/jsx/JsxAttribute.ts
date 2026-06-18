import type { JsxAttributeName } from "./JsxAttributeName";
import type { JsxAttributeValue } from "./JsxAttributeValue";

/**
 * A single JSX attribute, e.g. `attr="x"` or `attr={value}` or bare `attr`.
 *
 * Built by {@link factory.createJsxAttribute}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxAttribute {
  /** Discriminant tag; always `"JsxAttribute"`. */
  kind: "JsxAttribute";

  /** The name. */
  name: JsxAttributeName;

  /** The initializer, if any. */
  initializer?: JsxAttributeValue;
}
