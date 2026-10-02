import type { StringLiteral } from "../expressions/StringLiteral";
import type { JsxElement } from "./JsxElement";
import type { JsxExpression } from "./JsxExpression";
import type { JsxFragment } from "./JsxFragment";
import type { JsxSelfClosingElement } from "./JsxSelfClosingElement";

/**
 * The initializer of a {@link JsxAttribute}: a {@link StringLiteral}, a
 * {@link JsxExpression}, or a nested JSX element.
 *
 * @evidence contracts/common.md#principled-implementation Quoted text, expression containers and nested JSX forms preserve supported attribute-value spellings while omitting unrelated raw expression nodes.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns value alternatives and leaves name attachment to JsxAttribute.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Value alternatives describe syntax, without hardcoded values for particular components.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the initializer context and quoted/container/nested alternatives; separated prose follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeValue =
  | StringLiteral
  | JsxExpression
  | JsxElement
  | JsxSelfClosingElement
  | JsxFragment;
