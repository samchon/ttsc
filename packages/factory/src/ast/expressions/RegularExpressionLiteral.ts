/**
 * A regular expression literal, e.g. `/ab+c/gi`.
 *
 * Built by {@link factory.createRegularExpressionLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface RegularExpressionLiteral {
  /** Discriminant tag; always `"RegularExpressionLiteral"`. */
  kind: "RegularExpressionLiteral";

  /** Text. */
  text: string;
}
