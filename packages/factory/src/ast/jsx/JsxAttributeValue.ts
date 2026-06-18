import type { StringLiteral } from "../expressions/StringLiteral";
import type { JsxElement } from "./JsxElement";
import type { JsxExpression } from "./JsxExpression";
import type { JsxFragment } from "./JsxFragment";
import type { JsxSelfClosingElement } from "./JsxSelfClosingElement";

/**
 * The initializer of a {@link JsxAttribute} — a {@link StringLiteral}, a
 * {@link JsxExpression}, or a nested JSX element.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeValue =
  | StringLiteral
  | JsxExpression
  | JsxElement
  | JsxSelfClosingElement
  | JsxFragment;
