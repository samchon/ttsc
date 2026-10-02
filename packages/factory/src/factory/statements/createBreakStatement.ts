import type { BreakStatement, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link BreakStatement}: a `break;` statement.
 *
 * The optional `label` names an enclosing labeled statement to break out of. A
 * string is wrapped into an identifier; pass nothing for a plain `break`.
 *
 * With no label the result is:
 *
 * ```ts
 * break;
 * ```
 *
 * With `label` of `outer` the result is:
 *
 * ```ts
 * break outer;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional label stays absent for ordinary break and becomes Identifier for
 *   a supplied string. Valid enclosing break targets are caller context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The node owns target spelling, not a control-flow graph or label resolver.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Omission does not fabricate a label or replace the caller's loop.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains enclosing-label use and shows labeled/unlabeled forms
 *   in separate examples before the acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param label The label.
 * @returns The created {@link BreakStatement}.
 */
export const createBreakStatement = (
  label?: string | Identifier,
): BreakStatement =>
  make("BreakStatement", {
    label: label === undefined ? undefined : asName(label),
  });
