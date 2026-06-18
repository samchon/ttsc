import type { JSDoc, JSDocComment, JSDocTag } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDoc}: a `/** ... *\/` comment block.
 *
 * The `comment` is the leading summary text, and `tags` are the block tags that
 * follow it. The printer wraps the whole thing in the `/**` and `*\/`
 * delimiters and prefixes each interior line with `*`.
 *
 * With a `Just a summary.` comment and no tags, the printer emits:
 *
 * ```ts
 * /**
 *  * Just a summary.
 *  *\/
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param comment The leading comment text, if any.
 * @param tags The tags, if any.
 * @returns The created {@link JSDoc}.
 */
export const createJSDocComment = (
  comment?: string | readonly JSDocComment[] | undefined,
  tags?: readonly JSDocTag[] | undefined,
): JSDoc =>
  make("JSDoc", {
    comment,
    tags,
  });
