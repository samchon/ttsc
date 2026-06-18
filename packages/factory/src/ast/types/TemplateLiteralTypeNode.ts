import type { TemplateHead } from "../expressions/TemplateHead";
import type { TemplateLiteralTypeSpan } from "./TemplateLiteralTypeSpan";

/**
 * A template literal type, e.g. `prefix-${T}`.
 *
 * Built by {@link factory.createTemplateLiteralTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateLiteralTypeNode {
  /** Discriminant tag; always `"TemplateLiteralType"`. */
  kind: "TemplateLiteralType";

  /** Head. */
  head: TemplateHead;

  /** TemplateSpans. */
  templateSpans: readonly TemplateLiteralTypeSpan[];
}
