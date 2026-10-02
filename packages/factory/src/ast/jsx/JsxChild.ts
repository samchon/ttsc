import type { JsxElement } from "./JsxElement";
import type { JsxExpression } from "./JsxExpression";
import type { JsxFragment } from "./JsxFragment";
import type { JsxSelfClosingElement } from "./JsxSelfClosingElement";
import type { JsxText } from "./JsxText";

/**
 * Any node that may appear as a child of a {@link JsxElement} or
 * {@link JsxFragment}.
 *
 * @evidence contracts/common.md#principled-implementation Text, expression containers and nested JSX forms represent child-position alternatives without admitting attributes or raw expressions directly.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns children shared by paired elements and fragments.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Children remain caller syntax rather than component-specific rendered output substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies child placement in elements and fragments; native links and tag separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxChild =
  | JsxText
  | JsxExpression
  | JsxElement
  | JsxSelfClosingElement
  | JsxFragment;
