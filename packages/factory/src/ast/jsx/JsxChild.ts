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
 */
export type JsxChild =
  | JsxText
  | JsxExpression
  | JsxElement
  | JsxSelfClosingElement
  | JsxFragment;
