import type { PropertyAccessExpression } from "../expressions/PropertyAccessExpression";
import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { JsxNamespacedName } from "./JsxNamespacedName";

/**
 * The tag name of a JSX element: an {@link Identifier}, a `this` keyword
 * {@link Token}, a dotted {@link PropertyAccessExpression}, or a
 * {@link JsxNamespacedName}.
 *
 * Token is broader than the this keyword and PropertyAccessExpression permits
 * arbitrary expression bases. Callers must choose a tag-valid spelling.
 *
 * @evidence contracts/common.md#principled-implementation Bare, token, dotted and namespaced representations retain supported tag forms; broad token/base types do not establish that every member is a legal JSX tag.
 * @evidence contracts/common.md#clear-and-simple-design One tag-name alias shares naming between opening, closing and self-closing nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No component-name whitelist or consumer-specific tag correction is embedded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc lists tag alternatives and states broad-token/base validity limits separately, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxTagName =
  | Identifier
  | Token
  | PropertyAccessExpression
  | JsxNamespacedName;
