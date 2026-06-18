import type { JSDocText } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocText}: a run of plain text inside a JSDoc comment.
 *
 * The `text` is the literal content. The printer emits it verbatim, with no
 * decoration. This node holds the prose that sits between inline tags in a
 * comment body.
 *
 * With a `hello world` text, the printer emits:
 *
 * ```ts
 * hello world
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link JSDocText}.
 */
export const createJSDocText = (text: string): JSDocText =>
  make("JSDocText", {
    text,
  });
