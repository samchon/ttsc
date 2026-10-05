import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";
import type { TemplateLiteral } from "./TemplateLiteral";

/**
 * A tag expression applied to a template literal.
 *
 * Built by {@link factory.createTaggedTemplateExpression}.
 *
 * Generic arguments precede the template when supplied. A template's raw
 * spelling matters to its tag; provide rawText on its spans when that spelling
 * must be preserved. This outline does not call the tag.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Separate tag, generic arguments and TemplateLiteral fields retain tagged-template syntax; template span representations preserve raw spelling when supplied, but this type neither executes the tag nor derives missing raw source.
 * @evidence contracts/common.md#clear-and-simple-design One tag and one reused template representation avoid duplicating literal spans or modeling a tagged template as a normal call argument list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The tag and raw spelling remain explicit syntax rather than fabricated invocation results or patched template output.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains generic placement and the significance of raw spelling; field roles and acknowledgment tags use separate documentation blocks.
 */
export interface TaggedTemplateExpression {
  /** Discriminant tag; always `"TaggedTemplateExpression"`. */
  kind: "TaggedTemplateExpression";

  /** Expression receiving the template's cooked and raw spans at runtime. */
  tag: Expression;

  /** Optional generic arguments printed before the template. */
  typeArguments?: readonly TypeNode[];

  /** Complete template, with or without substitution spans. */
  template: TemplateLiteral;
}
