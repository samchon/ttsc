import type { TemplateHead } from "../expressions/TemplateHead";
import type { TemplateLiteralTypeSpan } from "./TemplateLiteralTypeSpan";

/**
 * A template literal type, e.g. `prefix-${T}`.
 *
 * Built by {@link factory.createTemplateLiteralType}.
 *
 * The final span must carry TemplateTail; the array shape does not enforce
 * the tail position or require a span to be present.
 *
 * @evidence contracts/common.md#principled-implementation A TemplateHead and ordered type spans preserve interpolated type spelling; callers must supply a final tail because the broad array does not enforce closure.
 * @evidence contracts/common.md#clear-and-simple-design Head and span sequence separate leading text from repeated interpolation payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Literal text and types are supplied data rather than hardcoded expected expansions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains final-tail responsibility and head/span roles; separated paragraphs follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateLiteralTypeNode {
  /** Discriminant tag; always `"TemplateLiteralType"`. */
  kind: "TemplateLiteralType";

  /** Leading text before the first type interpolation. */
  head: TemplateHead;

  /** Interpolated types and following text in source order; the last literal should be a tail. */
  templateSpans: readonly TemplateLiteralTypeSpan[];
}
