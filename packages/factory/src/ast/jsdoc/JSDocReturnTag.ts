import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@return` / `@returns` JSDoc tag.
 *
 * Built by {@link factory.createJSDocReturnTag}.
 *
 * Omitting typeExpression suppresses the braced type but leaves the tag and
 * any description. The tag name preserves `return` or `returns` spelling.
 *
 * @evidence contracts/common.md#principled-implementation An optional braced type admits return descriptions with or without a type, and an explicit identifier retains aliases without asserting agreement with an executable signature.
 * @evidence contracts/common.md#clear-and-simple-design Type absence is represented directly; tag spelling and prose remain independent without a second return-presence flag.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The return annotation retains supplied syntax rather than substituting an expected return value or patching a function body to match its description.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains omitted-type output and alias spelling; separated optional member comments and paragraphs follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocReturnTag {
  /** Discriminant tag; always `"JSDocReturnTag"`. */
  kind: "JSDocReturnTag";

  /** The tag name, e.g. `returns`. */
  tagName: Identifier;

  /** The type expression, if any. */
  typeExpression?: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
