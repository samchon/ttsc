import type { TypeNode } from "../types/TypeNode";
import type { JsxAttributes } from "./JsxAttributes";
import type { JsxTagName } from "./JsxTagName";

/**
 * The opening element of a {@link JsxElement}, e.g. `<Tag attr="x">`.
 *
 * Built by {@link factory.createJsxOpeningElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Tag, optional type arguments and attributes preserve opening syntax; matching a closing name and generic/component validity remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design Opening-only fields leave child grouping and closing syntax to JsxElement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied tags and attributes are retained without special consumer components or rendering substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates opening-tag attributes and identifies generic omission and attribute grouping; native spacing follows the documentation skill.
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
