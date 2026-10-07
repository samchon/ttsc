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
 * @evidence contracts/common.md#principled-implementation The required tag identifier, optional braced type and comment are retained directly, representing typed or untyped failure documentation without raising errors or analyzing thrown values.
 * @evidence contracts/common.md#clear-and-simple-design Direct payload assignments expose that the caller owns spelling; no default-name branch or exception-flow state is needed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure syntax is supplied data rather than an injected expected error, fixture-specific exception path or patched foreign throw handler.
 * @evidence contracts/common.md#meaningful-documentation Native prose and parameters identify caller-owned tag naming and the optional error type with an example; paragraph and native-tag separation follows the documentation guidance.
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
