import type {
  Identifier,
  JSDocComment,
  JSDocOverloadTag,
  JSDocSignature,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocOverloadTag}: an `@overload` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `overload` when omitted. The
 * `typeExpression` is the {@link JSDocSignature} describing the overload, and
 * `comment` is the trailing description. The printer prints the tag on the
 * first line, then the signature's `@param` and `@returns` tags on their own
 * lines.
 *
 * The signature is retained by reference and is not matched against executable
 * overload declarations.
 *
 * With the default tag name and a signature taking `{number} x` and returning
 * `{void}`, the printer emits:
 *
 * ```ts
 * @overload
 * @param {number} x
 * @returns {void}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The signature and comment are retained under the overload kind, with overload supplied only for an absent tag identifier; the annotation does not perform executable overload resolution.
 * @evidence contracts/common.md#clear-and-simple-design A direct signature assignment reuses its tag-role structure without an unused callback name or another signature assembly step.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default heading identifies supported syntax, while actual signature components remain supplied instead of a hardcoded dispatch case or patched resolution result.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the separate heading and signature lines, retained references and executable-validation boundary with an example; separated paragraphs follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `overload`.
 * @param typeExpression The overload signature.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocOverloadTag}.
 */
export const createJSDocOverloadTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocSignature,
  comment?: string | readonly JSDocComment[],
): JSDocOverloadTag =>
  make("JSDocOverloadTag", {
    tagName: tagName ?? createIdentifier("overload"),
    typeExpression,
    comment,
  });
