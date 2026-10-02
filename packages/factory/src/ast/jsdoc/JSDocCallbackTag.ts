import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocSignature } from "./JSDocSignature";

/**
 * A `@callback` JSDoc tag.
 *
 * Built by {@link factory.createJSDocCallbackTag}.
 *
 * The optional name follows the tag on its first line; the signature follows
 * on subsequent lines. Omitting the name leaves an unnamed callback annotation
 * without creating a callable declaration.
 *
 * @evidence contracts/common.md#principled-implementation A required documentation signature and optional identifier represent callback-tag payloads, retaining unnamed forms without claiming an executable callback or validated function type.
 * @evidence contracts/common.md#clear-and-simple-design The signature owns template, parameter and return tags; the callback tag adds only its heading name and optional description.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Callback structure is supplied through ordinary signature nodes rather than synthesized fixture signatures or foreign declaration replacement.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the first-line name, following signature and unnamed case, with separate member comments and paragraphs under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocCallbackTag {
  /** Discriminant tag; always `"JSDocCallbackTag"`. */
  kind: "JSDocCallbackTag";

  /** The tag name, e.g. `callback`. */
  tagName: Identifier;

  /** The callback signature. */
  typeExpression: JSDocSignature;

  /** Name printed after the tag; omission leaves an unnamed annotation. */
  fullName?: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
