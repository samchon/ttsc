import type { JsxTagName } from "./JsxTagName";

/**
 * The closing element of a {@link JsxElement}, e.g. `</Tag>`.
 *
 * Built by {@link factory.createJsxClosingElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation JsxTagName records closing-tag spelling; matching an opening tag is an enclosing-node caller responsibility rather than validated here.
 * @evidence contracts/common.md#clear-and-simple-design One tag-name payload reuses the same name union as opening tags without attributes or child state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The tag is supplied data with no fixture-specific component renaming.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates closing syntax and identifies the tag payload; separated member prose follows the documentation skill.
 */
export interface JsxClosingElement {
  /** Discriminant tag; always `"JsxClosingElement"`. */
  kind: "JsxClosingElement";

  /** The tag name. */
  tagName: JsxTagName;
}
