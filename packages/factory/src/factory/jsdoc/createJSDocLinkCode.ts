import type { EntityName, JSDocLinkCode, JSDocMemberName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocLinkCode}: an inline `{@linkcode ...}` reference.
 *
 * The `name` is the linked target, if any, and `text` is the trailing label,
 * rendered as code by documentation tooling. The printer appends the text to
 * the name verbatim, with no separator inserted between them, so any space you
 * want before the label must be part of `text`.
 *
 * With a `Foo` name and a ` the foo` text (note the leading space), the printer
 * emits:
 *
 * ```ts
 * {@linkcode Foo the foo}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The linkcode kind preserves code-style annotation spelling and stores the target and suffix unchanged; target resolution and code styling belong to documentation consumers.
 * @evidence contracts/common.md#clear-and-simple-design The constructor needs only name and text because the discriminant selects code-style syntax without a separate formatting option.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Code styling is expressed through the supported node form rather than replacing a consumer renderer or recognizing particular labels.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents styling ownership and the verbatim label separator, with an output example and separated paragraphs under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The linked name, if any.
 * @param text The trailing link text.
 * @returns The created {@link JSDocLinkCode}.
 */
export const createJSDocLinkCode = (
  name: EntityName | JSDocMemberName | undefined,
  text: string,
): JSDocLinkCode =>
  make("JSDocLinkCode", {
    name,
    text,
  });
