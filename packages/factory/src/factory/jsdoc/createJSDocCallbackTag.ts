import type {
  Identifier,
  JSDocCallbackTag,
  JSDocComment,
  JSDocSignature,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocCallbackTag}: a `@callback` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `callback` when omitted. The
 * `typeExpression` is the {@link JSDocSignature} describing the callback,
 * `fullName` is the callback's name, and `comment` is the trailing description.
 * The printer prints the tag and name on the first line, then the signature's
 * `@param` and `@returns` tags on their own lines.
 *
 * The signature and its children are retained by reference. This annotation
 * does not create a callable declaration or check its parameter consistency.
 *
 * With the default tag name, a name of `MyCb`, and a signature taking `{number}
 * x` and returning `{void}`, the printer emits:
 *
 * ```ts
 * @callback MyCb
 * @param {number} x
 * @returns {void}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Directly retaining the documentation signature, optional name and comment while defaulting an absent identifier to callback preserves named and unnamed annotations without creating an executable function.
 * @evidence contracts/common.md#clear-and-simple-design The signature owns its template, parameter and return components; this adapter adds only the heading payload and default spelling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Callback is a supported tag default, and the supplied signature is not replaced with a known fixture shape or a foreign callable declaration.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes heading/signature layout, retained references and unchecked parameter correspondence with an example; paragraph and native-tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `callback`.
 * @param typeExpression The callback signature.
 * @param fullName The full callback name, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocCallbackTag}.
 */
export const createJSDocCallbackTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocSignature,
  fullName?: Identifier,
  comment?: string | readonly JSDocComment[],
): JSDocCallbackTag =>
  make("JSDocCallbackTag", {
    tagName: tagName ?? createIdentifier("callback"),
    typeExpression,
    fullName,
    comment,
  });
