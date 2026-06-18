/**
 * Literal text appearing as a child of a {@link JsxElement} or
 * {@link JsxFragment}.
 *
 * Built by {@link factory.createJsxText}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxText {
  /** Discriminant tag; always `"JsxText"`. */
  kind: "JsxText";

  /** The text. */
  text: string;

  /** Whether the text contains only trivia whitespace. */
  containsOnlyTriviaWhiteSpaces: boolean;
}
