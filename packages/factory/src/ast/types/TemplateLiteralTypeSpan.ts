import type { TemplateMiddle } from "../expressions/TemplateMiddle";
import type { TemplateTail } from "../expressions/TemplateTail";
import type { TypeNode } from "./TypeNode";

/**
 * A `${type}literal` span of a template literal type.
 *
 * Built by {@link factory.createTemplateLiteralTypeSpan}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateLiteralTypeSpan {
  /** Discriminant tag; always `"TemplateLiteralTypeSpan"`. */
  kind: "TemplateLiteralTypeSpan";

  /** Type. */
  type: TypeNode;

  /** Literal. */
  literal: TemplateMiddle | TemplateTail;
}
