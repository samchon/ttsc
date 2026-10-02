import type { TypeNode } from "../types/TypeNode";
import type { JsxAttributes } from "./JsxAttributes";
import type { JsxTagName } from "./JsxTagName";

/**
 * The opening element of a {@link JsxElement}, e.g. `<Tag attr="x">`.
 *
 * Built by {@link factory.createJsxOpeningElement}.
 *
 * @evidence contracts/common.md#principled-implementation Tag, optional type arguments and attributes preserve opening syntax; matching a closing name and generic/component validity remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design Opening-only fields leave child grouping and closing syntax to JsxElement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied tags and attributes are retained without special consumer components or rendering substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates opening-tag attributes and identifies generic omission and attribute grouping; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
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
