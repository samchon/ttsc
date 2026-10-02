import type { JsxAttributeName } from "./JsxAttributeName";
import type { JsxAttributeValue } from "./JsxAttributeValue";

/**
 * A single JSX attribute, e.g. `attr="x"` or `attr={value}` or bare `attr`.
 *
 * Built by {@link factory.createJsxAttribute}.
 *
 * @evidence contracts/common.md#principled-implementation Name and optional JsxAttributeValue preserve valued versus bare attributes; absence prints a bare name rather than manufacturing a boolean value node.
 * @evidence contracts/common.md#clear-and-simple-design Shared name/value unions own their alternatives while this node owns attachment and initializer presence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names and values are supplied syntax without special component attributes for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates quoted, expression and bare attributes and explains omitted initializer; comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxAttribute {
  /** Discriminant tag; always `"JsxAttribute"`. */
  kind: "JsxAttribute";

  /** The name. */
  name: JsxAttributeName;

  /** Supplied attribute value; absent for a bare boolean attribute name. */
  initializer?: JsxAttributeValue;
}
