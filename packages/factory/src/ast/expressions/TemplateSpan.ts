import type { Expression } from "./Expression";
import type { TemplateMiddle } from "./TemplateMiddle";
import type { TemplateTail } from "./TemplateTail";

/**
 * A `${expression}literal` span of a template string.
 *
 * Built by {@link factory.createTemplateSpan}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateSpan {
  /** Discriminant tag; always `"TemplateSpan"`. */
  kind: "TemplateSpan";

  /** Expression. */
  expression: Expression;

  /** Literal. */
  literal: TemplateMiddle | TemplateTail;
}
