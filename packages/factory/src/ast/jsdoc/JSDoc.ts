import type { JSDocComment } from "./JSDocComment";
import type { JSDocTag } from "./JSDocTag";

/**
 * A full JSDoc comment block, e.g. `/** ... *\/`.
 *
 * Built by {@link factory.createJSDocComment}.
 *
 * Body fragments and tags retain their supplied order. Text is not escaped;
 * callers must avoid a closing comment delimiter in their content. The block
 * printer prefixes every physical content line, including embedded newlines
 * and multiline tags, with a comment-body marker.
 *
 * @evidence contracts/common.md#principled-implementation Separate body and tag sequences express the two parts of a JSDoc block; optional sequences permit a block with no prose or tags without implying semantic validation.
 * @evidence contracts/common.md#clear-and-simple-design The block owns only its body and ordered tags; inline formatting and tag payloads stay in their respective node types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed kind identifies block syntax, while caller-supplied prose and tags remain data rather than consumer-specific output or foreign mutations.
 * @evidence contracts/common.md#meaningful-documentation Native prose records ordering, raw-text responsibility and physical-line prefixing; separated members and paragraphs follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDoc {
  /** Discriminant tag; always `"JSDoc"`. */
  kind: "JSDoc";

  /** The leading comment text, if any. */
  comment?: string | readonly JSDocComment[];

  /** The tags, if any. */
  tags?: readonly JSDocTag[];
}
