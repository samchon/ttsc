import type { PrivateIdentifier } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link PrivateIdentifier}: a class private name beginning with `#`.
 *
 * The `text` is the name content. The leading `#` is added automatically when
 * it is missing, so both `secret` and `#secret` yield the same node. The
 * printer emits the name with exactly one `#`.
 *
 * With `text` of `secret`, this prints:
 *
 * ```ts
 * #secret
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The private-name outline stores a leading #; conditional prefixing accepts
 *   both caller spellings without duplicating that prefix. Valid names are required.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Prefix normalization feeds make directly; it does not add name allocation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   # is the private-identifier delimiter rather than a generated answer.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains optional caller prefixing and its printed result;
 *   the example and tags occupy separate paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @returns The created {@link PrivateIdentifier}.
 */
export const createPrivateIdentifier = (text: string): PrivateIdentifier =>
  make("PrivateIdentifier", { text: text.startsWith("#") ? text : `#${text}` });
