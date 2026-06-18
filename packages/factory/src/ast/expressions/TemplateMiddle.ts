/**
 * A `}middle${` chunk of a template literal.
 *
 * Built by {@link factory.createTemplateMiddle}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateMiddle {
  /** Discriminant tag; always `"TemplateMiddle"`. */
  kind: "TemplateMiddle";

  /** Text. */
  text: string;
}
