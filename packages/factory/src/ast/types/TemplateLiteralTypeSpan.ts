import type { TemplateMiddle } from "../expressions/TemplateMiddle";
import type { TemplateTail } from "../expressions/TemplateTail";
import type { TypeNode } from "./TypeNode";

/**
 * A `${type}literal` span of a template literal type.
 *
 * Built by {@link factory.createTemplateLiteralTypeSpan}.
 *
 * @evidence contracts/common.md#principled-implementation The interpolated TypeNode and following middle/tail distinguish continued interpolation from closing text; array position is validated by the caller.
 * @evidence contracts/common.md#clear-and-simple-design Two fields retain the interpolation's type and subsequent literal without duplicating the parent head.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Text and type operands are caller data, with no precomputed template expansion.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies interpolation syntax and explains middle/tail roles; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateLiteralTypeSpan {
  /** Discriminant tag; always `"TemplateLiteralTypeSpan"`. */
  kind: "TemplateLiteralTypeSpan";

  /** Type inside the interpolation braces. */
  type: TypeNode;

  /** Following literal segment; a tail closes the template, while a middle starts another interpolation. */
  literal: TemplateMiddle | TemplateTail;
}
