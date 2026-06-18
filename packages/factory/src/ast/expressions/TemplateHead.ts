/**
 * The opening ``head${` chunk of a template literal.
 *
 * Built by {@link factory.createTemplateHead}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateHead {
  /** Discriminant tag; always `"TemplateHead"`. */
  kind: "TemplateHead";

  /** Text. */
  text: string;

  /** RawText. */
  rawText?: string;
}
