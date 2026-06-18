import type { TemplateHead } from "./TemplateHead";
import type { TemplateSpan } from "./TemplateSpan";

/**
 * A template string with substitutions, e.g. `a${b}c`.
 *
 * Built by {@link factory.createTemplateExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateExpression {
  /** Discriminant tag; always `"TemplateExpression"`. */
  kind: "TemplateExpression";

  /** Head. */
  head: TemplateHead;

  /** TemplateSpans. */
  templateSpans: readonly TemplateSpan[];
}
