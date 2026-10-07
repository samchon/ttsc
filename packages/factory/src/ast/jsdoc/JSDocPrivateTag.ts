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
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A private-tag kind and named annotation retain documentation intent while leaving language-level private access to the actual declaration.
 * @evidence contracts/common.md#clear-and-simple-design The syntax record stores no access-checking state or duplicate modifiers; its only variable payload is tag spelling and optional prose.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Private documentation is explicit data rather than an API-name blacklist or foreign access-control mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the annotation's enforcement boundary and missing-description result; separated paragraphs and members follow the documentation guidance.
 */
export interface JSDocPrivateTag {
  /** Discriminant tag; always `"JSDocPrivateTag"`. */
  kind: "JSDocPrivateTag";

  /** The tag name, e.g. `private`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
