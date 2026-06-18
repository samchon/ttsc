/**
 * A template literal with no substitutions, e.g. `text`.
 *
 * Built by {@link factory.createNoSubstitutionTemplateLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NoSubstitutionTemplateLiteral {
  /** Discriminant tag; always `"NoSubstitutionTemplateLiteral"`. */
  kind: "NoSubstitutionTemplateLiteral";

  /** Text. */
  text: string;
}
