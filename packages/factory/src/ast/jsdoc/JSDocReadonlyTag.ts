import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@readonly` JSDoc tag.
 *
 * Built by {@link factory.createJSDocReadonlyTag}.
 *
 * This is a documentation marker. It does not freeze a value or add a readonly
 * modifier to a declaration; omitting prose leaves a bare tag.
 *
 * @evidence contracts/common.md#principled-implementation A readonly-tag kind and optional description express the annotation while keeping printed mutability intent distinct from language or runtime enforcement.
 * @evidence contracts/common.md#clear-and-simple-design The marker needs no target storage or mutation policy; the tag identifier and description are the complete printed payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readonly intent is explicit annotation data rather than freezing caller objects or replacing foreign setters.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the absence of freezing or modifier insertion and the bare-tag case; paragraphs and members follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocReadonlyTag {
  /** Discriminant tag; always `"JSDocReadonlyTag"`. */
  kind: "JSDocReadonlyTag";

  /** The tag name, e.g. `readonly`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
