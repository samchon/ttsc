import type { JSDocText } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocText}: a run of plain text inside a JSDoc comment.
 *
 * The `text` is the literal content. The printer emits it verbatim, with no
 * decoration. This node holds the prose that sits between inline tags in a
 * comment body.
 *
 * Spaces and newlines remain caller data. No comment-delimiter escaping is
 * performed, so content must be safe for its enclosing comment.
 *
 * With a `hello world` text, the printer emits:
 *
 * ```ts
 * hello world
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The string is stored directly under the text kind so the printer can preserve literal comment content, without implying parsing or escaping.
 * @evidence contracts/common.md#clear-and-simple-design One payload assignment constructs the fragment; enclosing layout and inline references remain outside this text adapter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Arbitrary content is preserved rather than replaced with expected prose or passed through a patched foreign comment processor.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains verbatim content, spacing and delimiter responsibility with an example; paragraph and tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link JSDocText}.
 */
export const createJSDocText = (text: string): JSDocText =>
  make("JSDocText", {
    text,
  });
