import type { JsxTagName } from "./JsxTagName";

/**
 * The closing element of a {@link JsxElement}, e.g. `</Tag>`.
 *
 * Built by {@link factory.createJsxClosingElement}.
 *
 * @evidence contracts/common.md#principled-implementation JsxTagName records closing-tag spelling; matching an opening tag is an enclosing-node caller responsibility rather than validated here.
 * @evidence contracts/common.md#clear-and-simple-design One tag-name payload reuses the same name union as opening tags without attributes or child state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The tag is supplied data with no fixture-specific component renaming.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates closing syntax and identifies the tag payload; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxClosingElement {
  /** Discriminant tag; always `"JsxClosingElement"`. */
  kind: "JsxClosingElement";

  /** The tag name. */
  tagName: JsxTagName;
}
