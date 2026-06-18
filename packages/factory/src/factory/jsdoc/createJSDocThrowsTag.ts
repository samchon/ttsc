import type {
  Identifier,
  JSDocComment,
  JSDocThrowsTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocThrowsTag}: a `@throws` JSDoc tag.
 *
 * The `tagName` is the identifier after the `@`, such as `throws`. The
 * `typeExpression` supplies the brace-wrapped thrown type, and `comment` is the
 * trailing description.
 *
 * With a tag name of `throws`, an `{Error}` type expression, and an `on
 * failure` comment, the printer emits:
 *
 * ```ts
 * @throws {Error} on failure
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param typeExpression The type expression, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocThrowsTag}.
 */
export const createJSDocThrowsTag = (
  tagName: Identifier,
  typeExpression: JSDocTypeExpression | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocThrowsTag =>
  make("JSDocThrowsTag", {
    tagName,
    typeExpression,
    comment,
  });
