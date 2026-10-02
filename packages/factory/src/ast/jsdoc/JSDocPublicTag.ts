import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@public` JSDoc tag.
 *
 * Built by {@link factory.createJSDocPublicTag}.
 *
 * This records documentation visibility, not a TypeScript access modifier.
 * Omitting the description emits a bare visibility tag.
 *
 * @evidence contracts/common.md#principled-implementation The public-tag kind preserves a documentation visibility annotation with an explicit name and optional prose, without claiming to change access control.
 * @evidence contracts/common.md#clear-and-simple-design Visibility intent is carried by the kind while comment text remains optional; declaration modifiers are not duplicated here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Public visibility is supplied through a supported annotation node rather than patched declarations or consumer-specific export exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes documentation visibility from access control and states omission behavior, with paragraph and member separation under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocPublicTag {
  /** Discriminant tag; always `"JSDocPublicTag"`. */
  kind: "JSDocPublicTag";

  /** The tag name, e.g. `public`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
