import type { JsxAttributeLike } from "./JsxAttributeLike";

/**
 * The ordered collection of attributes attached to a JSX opening element.
 *
 * Built by {@link factory.createJsxAttributes}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered named/spread attributes preserve their printed sequence without adding braces around the whole list or resolving duplicate properties.
 * @evidence contracts/common.md#clear-and-simple-design One collection owns attribute ordering while each variant owns its name/value or spread operand.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The collection retains caller attributes rather than injecting fixture-specific component props.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies ordered opening attributes and the property sequence; native member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxAttributes {
  /** Discriminant tag; always `"JsxAttributes"`. */
  kind: "JsxAttributes";

  /** The attribute properties. */
  properties: readonly JsxAttributeLike[];
}
