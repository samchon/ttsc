import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@this` JSDoc tag.
 *
 * Built by {@link factory.createJSDocThisTag}.
 *
 * The braced type describes the receiver expected by documentation consumers.
 * It does not bind a function's receiver or validate a call.
 *
 * @evidence contracts/common.md#principled-implementation A required braced type expresses the documented receiver annotation while distinguishing it from actual receiver binding or call-site type checking.
 * @evidence contracts/common.md#clear-and-simple-design Receiver syntax uses the existing type-expression wrapper; the tag adds only its identifier and optional description.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The receiver remains supplied annotation data instead of a hardcoded object identity or foreign function rebinding.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the receiver role and lack of binding or validation, with paragraph and member separation under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocThisTag {
  /** Discriminant tag; always `"JSDocThisTag"`. */
  kind: "JSDocThisTag";

  /** The tag name, e.g. `this`. */
  tagName: Identifier;

  /** The type expression. */
  typeExpression: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
