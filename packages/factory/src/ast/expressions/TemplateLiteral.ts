import type { NoSubstitutionTemplateLiteral } from "./NoSubstitutionTemplateLiteral";
import type { TemplateExpression } from "./TemplateExpression";

/**
 * A template literal expression (with or without substitutions).
 *
 * Individual heads, middles and tails are chunks and are excluded here; a
 * substituted template must supply its complete head-and-span outline.
 *
 * @evidence contracts/common.md#principled-implementation The two alternatives distinguish an entire one-span literal from a composed substitution template, excluding incomplete chunk nodes from complete-template positions.
 * @evidence contracts/common.md#clear-and-simple-design One union reuses the existing complete template shapes without adding another wrapper or optional span schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Complete templates remain structured literals rather than arbitrary source text substituted for missing chunks.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the complete-template boundary and excluded chunks, with a separate acknowledgment block following documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type TemplateLiteral =
  | NoSubstitutionTemplateLiteral
  | TemplateExpression;
