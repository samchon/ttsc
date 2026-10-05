import type { JsxElement } from "./JsxElement";
import type { JsxExpression } from "./JsxExpression";
import type { JsxFragment } from "./JsxFragment";
import type { JsxSelfClosingElement } from "./JsxSelfClosingElement";
import type { JsxText } from "./JsxText";

/**
 * Any node that may appear as a child of a {@link JsxElement} or
 * {@link JsxFragment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Text, expression containers and nested JSX forms represent child-position alternatives without admitting attributes or raw expressions directly.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns children shared by paired elements and fragments.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Children remain caller syntax rather than component-specific rendered output substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies child placement in elements and fragments; native links and tag separation follow the documentation skill.
 */
export type JsxChild =
  | JsxText
  | JsxExpression
  | JsxElement
  | JsxSelfClosingElement
  | JsxFragment;
