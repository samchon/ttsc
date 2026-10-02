import type { JsxChild } from "./JsxChild";
import type { JsxClosingElement } from "./JsxClosingElement";
import type { JsxOpeningElement } from "./JsxOpeningElement";

/**
 * A paired JSX element, e.g. `<Tag>children</Tag>`.
 *
 * Built by {@link factory.createJsxElement}.
 *
 * Opening and closing names must match for valid JSX. The independent fields
 * preserve supplied nodes and do not enforce that relationship.
 *
 * @evidence contracts/common.md#principled-implementation Opening node, ordered children and closing node retain paired JSX syntax; name equality is an explicit caller premise not established by the independent tag fields.
 * @evidence contracts/common.md#clear-and-simple-design The element owns grouping/order while opening, closing and child nodes own their syntax payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied tags and children are preserved without fixture-specific tag corrections or rendering logic.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates pairing and states name-matching responsibility in a separate paragraph; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
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
