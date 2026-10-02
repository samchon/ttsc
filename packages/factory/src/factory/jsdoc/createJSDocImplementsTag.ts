import type {
  ExpressionWithTypeArguments,
  Identifier,
  JSDocComment,
  JSDocImplementsTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocImplementsTag}: an `@implements` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `implements` when omitted. The
 * `className` is the implemented interface or class expression, which the
 * printer wraps in braces. The `comment` is the trailing description, if any.
 *
 * With the default tag name and an `Iface` class expression, the printer emits:
 *
 * ```ts
 * @implements {Iface}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Mapping className to the class operand and defaulting only an absent identifier to implements retains target syntax without claiming that a declaration satisfies the target.
 * @evidence contracts/common.md#clear-and-simple-design The existing expression-with-type-arguments node owns target structure; this adapter supplies the tag name and comment without another implementation model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Implements is a supported annotation default, while the target is supplied rather than a hardcoded successful interface match or patched declaration.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the interface/class target, brace output and optional comment with an example; paragraph and parameter-tag separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `implements`.
 * @param className The implemented class.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocImplementsTag}.
 */
export const createJSDocImplementsTag = (
  tagName: Identifier | undefined,
  className: ExpressionWithTypeArguments,
  comment?: string | readonly JSDocComment[],
): JSDocImplementsTag =>
  make("JSDocImplementsTag", {
    tagName: tagName ?? createIdentifier("implements"),
    class: className,
    comment,
  });
