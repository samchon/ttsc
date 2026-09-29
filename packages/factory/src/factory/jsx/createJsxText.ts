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
 * Hello
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Raw text remains unchanged and the trivia hint normalizes to a boolean;
 *   the hint does not authorize trimming or escaping characters in emitted JSX.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Text and its annotation are the only fields; the printer owns raw-text
 *   preservation and whitespace-safe surrounding layout rather than the builder.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Text is not matched against expected markup or secretly escaped. The
 *   explicit raw-input contract requires callers to provide suitable JSX content.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states verbatim output and the flag's lack of character effect;
 *   the corrected Hello example contains no invented semicolon.
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
