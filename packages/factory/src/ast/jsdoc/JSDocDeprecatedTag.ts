import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@deprecated` JSDoc tag.
 *
 * Built by {@link factory.createJSDocDeprecatedTag}.
 *
 * Use the optional description to explain the replacement or migration. The
 * marker prints documentation and does not disable the documented API.
 *
 * @evidence contracts/common.md#principled-implementation A deprecation kind with a tag identifier and optional prose represents the annotation without conflating it with availability or compiler enforcement.
 * @evidence contracts/common.md#clear-and-simple-design Migration guidance remains comment text; no version policy or replacement resolver is added to this syntax container.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Deprecation is an explicit tag payload rather than a name-based API exception or a patched call-site check.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains migration guidance and the absence of API disabling, with separate usage paragraphs and documented members under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocDeprecatedTag {
  /** Discriminant tag; always `"JSDocDeprecatedTag"`. */
  kind: "JSDocDeprecatedTag";

  /** The tag name, e.g. `deprecated`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
