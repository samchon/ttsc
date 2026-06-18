/**
 * A string literal expression.
 *
 * Built by {@link factory.createStringLiteral}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface StringLiteral {
  /** Discriminant tag; always `"StringLiteral"`. */
  kind: "StringLiteral";

  /** The string content (unescaped). */
  text: string;

  /** When `true`, emit with single quotes instead of double. */
  singleQuote?: boolean;
}
