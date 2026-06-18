import type { JsxText } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxText}: a run of literal text appearing as a child between
 * JSX tags.
 *
 * The `text` is the raw character content, written verbatim with no quoting or
 * escaping. The `containsOnlyTriviaWhiteSpaces` flag marks text that is nothing
 * but insignificant whitespace (spaces, tabs, newlines between tags); it is
 * coerced to a boolean and defaults to `false`. The flag does not change the
 * printed characters; it records whether the run is meaningful content.
 *
 * Given the text `Hello`, the printer emits:
 *
 * ```tsx
 * Hello;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @param containsOnlyTriviaWhiteSpaces Whether the text contains only trivia
 *   whitespace.
 * @returns The created {@link JsxText}.
 */
export const createJsxText = (
  text: string,
  containsOnlyTriviaWhiteSpaces?: boolean,
): JsxText =>
  make("JsxText", {
    text,
    containsOnlyTriviaWhiteSpaces: !!containsOnlyTriviaWhiteSpaces,
  });
