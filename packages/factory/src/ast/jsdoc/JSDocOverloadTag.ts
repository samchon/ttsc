import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocSignature } from "./JSDocSignature";

/**
 * An `@overload` JSDoc tag.
 *
 * Built by {@link factory.createJSDocOverloadTag}.
 *
 * The signature's tags follow the heading on separate lines. This annotation
 * has no overload name and does not select an executable overload.
 *
 * @evidence contracts/common.md#principled-implementation A required JSDocSignature supplies the structured overload description while the tag kind distinguishes it from a named callback and makes no overload-resolution claim.
 * @evidence contracts/common.md#clear-and-simple-design Signature roles stay in their owning container; the overload heading adds no unused callback-name member or executable declaration state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Overload information remains explicit documentation rather than a known-call dispatch exception or a patched resolution result.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes multiline signatures and the distinction from executable overload selection, using separated paragraphs and documented members under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocOverloadTag {
  /** Discriminant tag; always `"JSDocOverloadTag"`. */
  kind: "JSDocOverloadTag";

  /** The tag name, e.g. `overload`. */
  tagName: Identifier;

  /** The overload signature. */
  typeExpression: JSDocSignature;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
