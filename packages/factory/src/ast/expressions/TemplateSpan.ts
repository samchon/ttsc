import type { Expression } from "./Expression";
import type { TemplateMiddle } from "./TemplateMiddle";
import type { TemplateTail } from "./TemplateTail";

/**
 * One template substitution and the literal chunk that follows it.
 *
 * Built by {@link factory.createTemplateSpan}.
 *
 * TemplateMiddle introduces another substitution; TemplateTail closes the
 * template. The preceding head or middle owns the `${` opening this expression.
 *
 * @evidence contracts/common.md#principled-implementation Pairing one expression with a middle-or-tail chunk preserves substitution/content alternation and the distinction between continuation and termination; enclosing order remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One pair is the template's repeatable unit; no duplicated preceding head or delimiter tokens are needed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Substitution syntax remains an expression rather than a precomputed value spliced into literal text.
 * @evidence contracts/common.md#meaningful-documentation Native prose and members explain delimiter ownership and middle-versus-tail effects, with separate comments and acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateSpan {
  /** Discriminant tag; always `"TemplateSpan"`. */
  kind: "TemplateSpan";

  /** Substitution expression following the preceding chunk's `${`. */
  expression: Expression;

  /** Following content: middle continues substitutions, tail closes the template. */
  literal: TemplateMiddle | TemplateTail;
}
