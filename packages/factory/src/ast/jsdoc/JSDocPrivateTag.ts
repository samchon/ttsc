import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@private` JSDoc tag.
 *
 * Built by {@link factory.createJSDocPrivateTag}.
 *
 * The annotation records documentation visibility without enforcing private
 * access. An absent description leaves only the tag identifier.
 *
 * @evidence contracts/common.md#principled-implementation A private-tag kind and named annotation retain documentation intent while leaving language-level private access to the actual declaration.
 * @evidence contracts/common.md#clear-and-simple-design The syntax record stores no access-checking state or duplicate modifiers; its only variable payload is tag spelling and optional prose.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Private documentation is explicit data rather than an API-name blacklist or foreign access-control mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the annotation's enforcement boundary and missing-description result; separated paragraphs and members follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocPrivateTag {
  /** Discriminant tag; always `"JSDocPrivateTag"`. */
  kind: "JSDocPrivateTag";

  /** The tag name, e.g. `private`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
