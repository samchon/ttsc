import type { ContinueStatement, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ContinueStatement}: a `continue;` statement.
 *
 * The optional `label` names an enclosing labeled loop to continue. A string is
 * wrapped into an identifier; pass nothing for a plain `continue`.
 *
 * With no label the result is:
 *
 * ```ts
 * continue;
 * ```
 *
 * With `label` of `outer` the result is:
 *
 * ```ts
 * continue outer;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional normalized label preserves labeled versus unlabeled continue;
 *   enclosing loop validity cannot be established by this standalone node.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Target-name normalization shares asName; loop ownership stays with callers.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No retry or simulated control flow replaces the requested continue syntax.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes plain continue from an enclosing-loop label, with
 *   separated examples and blank comment lines before acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param label The label.
 * @returns The created {@link ContinueStatement}.
 */
export const createContinueStatement = (
  label?: string | Identifier,
): ContinueStatement =>
  make("ContinueStatement", {
    label: label === undefined ? undefined : asName(label),
  });
