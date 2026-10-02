import type { TemplateHead } from "./TemplateHead";
import type { TemplateSpan } from "./TemplateSpan";

/**
 * A backtick template string containing substitutions.
 *
 * Built by {@link factory.createTemplateExpression}.
 *
 * A valid outline has at least one span, intermediate spans ending in
 * TemplateMiddle and the last ending in TemplateTail. The sequence type does
 * not enforce those placement rules.
 *
 * @evidence contracts/common.md#principled-implementation An opening head followed by ordered substitution/literal spans represents the alternating template grammar; a nonempty sequence with a terminal tail is a caller premise not enforced by readonly TemplateSpan[].
 * @evidence contracts/common.md#clear-and-simple-design Head and span sequence reuse the three literal chunk forms instead of flattening expressions into source text.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Substitutions remain expression nodes rather than known interpolated answers or patched literal strings.
 * @evidence contracts/common.md#meaningful-documentation Native prose states nonempty and terminal-tail requirements; member comments describe sequence roles, separated from tags under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateExpression {
  /** Discriminant tag; always `"TemplateExpression"`. */
  kind: "TemplateExpression";

  /** Opening content before the first substitution. */
  head: TemplateHead;

  /** Substitutions in order; the final span must end in TemplateTail. */
  templateSpans: readonly TemplateSpan[];
}
