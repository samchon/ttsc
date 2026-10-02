import type { JSDoc, JSDocComment, JSDocTag } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDoc}: a `/** ... *\/` comment block.
 *
 * The `comment` is the leading summary text, and `tags` are the block tags that
 * follow it. The printer wraps the whole thing in the `/**` and `*\/`
 * delimiters. Every physical content line receives its own `*` prefix,
 * including embedded newlines and multiline tags. Text is not escaped; avoid
 * a closing comment delimiter inside supplied content.
 *
 * An absent or empty `comment` writes no summary line, so a block of tags
 * starts with its first tag.
 *
 * Arrays and child nodes are retained by reference, not copied. Later caller
 * mutation can change subsequent printing of this block.
 *
 * With a `Just a summary.` comment and no tags, the printer emits:
 *
 * ```ts
 * /**
 *  * Just a summary.
 *  *\/
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The adapter stores the optional body and ordered tags unchanged under the JSDoc kind; make adds the discriminant without parsing, copying or validating prose.
 * @evidence contracts/common.md#clear-and-simple-design Two direct payload assignments expose body and tag ownership; block rendering stays in the printer rather than another comment assembly layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller text and tags remain explicit inputs, with no recognized-summary special case or replacement of a foreign comment emitter.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents delimiters, physical-line prefixing, unescaped content and retained references; separated ideas and parameter tags follow the documentation guidance. The rule that an empty summary writes no line is stated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
