import type { ExportAssignment, Expression, ModifierLike } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ExportAssignment}: an `export default` or `export =`
 * statement that exports a single expression.
 *
 * Set `isExportEquals` to `true` for the CommonJS-style `export =` form;
 * otherwise the node prints as `export default`. The `expression` is the value
 * being exported.
 *
 * Given the identifier `foo` with `isExportEquals` false, this prints:
 *
 * ```ts
 * export default foo;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   isExportEquals distinguishes export-assignment syntax from export default;
 *   expression is retained as a tree, so the printer owns required parentheses.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One node holds the expression and form switch without two duplicate builders.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Export-equals is an explicit source form, not a module.exports runtime patch.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the boolean's two source forms and exported expression,
 *   with an example and acknowledgment tags in separated paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param isExportEquals When `true`, emit `export =`; otherwise `export
 *   default`.
 * @param expression The expression.
 * @returns The created {@link ExportAssignment}.
 */
export const createExportAssignment = (
  modifiers: readonly ModifierLike[] | undefined,
  isExportEquals: boolean | undefined,
  expression: Expression,
): ExportAssignment =>
  make("ExportAssignment", { modifiers, isExportEquals, expression });
