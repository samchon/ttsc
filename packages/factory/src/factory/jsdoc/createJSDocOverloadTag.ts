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
 * With the default tag name and a signature taking `{number} x` and returning
 * `{void}`, the printer emits:
 *
 * ```ts
 * @overload
 * @param {number} x
 * @returns {void}
 * ```
 *
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
