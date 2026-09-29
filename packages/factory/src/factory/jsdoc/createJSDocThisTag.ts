import type {
  Identifier,
  JSDocComment,
  JSDocThisTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocThisTag}: a `@this` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `this` when omitted. The
 * `typeExpression` supplies the brace-wrapped `this` type, and `comment` is the
 * trailing description, if any.
 *
 * With the default tag name and a `{Foo}` type expression, the printer emits:
 *
 * ```ts
 * @this {Foo}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The required type-expression child and supplied identifier or this default record receiver annotation syntax without binding a receiver or validating a call.
 * @evidence contracts/common.md#clear-and-simple-design The adapter reuses the braced type payload and adds only defaulted spelling and description, avoiding receiver-state machinery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is a supported tag default rather than a fixed receiver identity, and construction does not rebind foreign functions.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains receiver type, default spelling and trailing description with an example; paragraph and native-tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `this`.
 * @param typeExpression The type expression.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocThisTag}.
 */
export const createJSDocThisTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocTypeExpression,
  comment?: string | readonly JSDocComment[],
): JSDocThisTag =>
  make("JSDocThisTag", {
    tagName: tagName ?? createIdentifier("this"),
    typeExpression,
    comment,
  });
