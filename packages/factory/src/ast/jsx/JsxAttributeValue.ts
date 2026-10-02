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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeValue =
  | StringLiteral
  | JsxExpression
  | JsxElement
  | JsxSelfClosingElement
  | JsxFragment;
