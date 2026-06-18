/**
 * The closing `}tail`` chunk of a template literal.
 *
 * Built by {@link factory.createTemplateTail}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateTail {
  /** Discriminant tag; always `"TemplateTail"`. */
  kind: "TemplateTail";

  /** Text. */
  text: string;
}
