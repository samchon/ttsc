import type { TypeNode } from "../types/TypeNode";
import type { JsxAttributes } from "./JsxAttributes";
import type { JsxTagName } from "./JsxTagName";

/**
 * A self-closing JSX element, e.g. `<Tag attr="x" />`.
 *
 * Built by {@link factory.createJsxSelfClosingElement}.
 *
 * @evidence contracts/common.md#principled-implementation Tag, optional type arguments and attributes preserve self-closing syntax with no child sequence; semantic component validity is not established by the shape.
 * @evidence contracts/common.md#clear-and-simple-design Opening-header fields suffice because this form has no independent closing node or children.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Self-closing syntax is explicit rather than a fixture-selected suppression of child rendering.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates the self-closing delimiter and explains header payloads and generic absence; native spacing follows the documentation skill.
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
