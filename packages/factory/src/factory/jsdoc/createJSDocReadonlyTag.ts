import type { Identifier, JSDocComment, JSDocReadonlyTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocReadonlyTag}: a `@readonly` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `readonly` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @readonly
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `readonly`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocReadonlyTag}.
 */
export const createJSDocReadonlyTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocReadonlyTag =>
  make("JSDocReadonlyTag", {
    tagName: tagName ?? createIdentifier("readonly"),
    comment,
  });
