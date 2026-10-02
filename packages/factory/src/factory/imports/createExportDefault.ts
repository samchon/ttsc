import type { ExportAssignment, Expression } from "../../ast";
import { createExportAssignment } from "./createExportAssignment";

/**
 * Create an `export default` statement for the given expression.
 *
 * This is a convenience wrapper over {@link createExportAssignment} with the
 * modifiers omitted and `isExportEquals` fixed to `false`, so it always
 * produces the `export default` form rather than `export =`.
 *
 * Given the identifier `foo`, this prints:
 *
 * ```ts
 * export default foo;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Passing false for isExportEquals chooses export default and undefined
 *   modifiers leaves the caller expression as the only export payload.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This convenience delegates statement construction to createExportAssignment.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Fixed false and omitted modifiers define this named convenience's contract.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc documents the exact delegated defaults and shows export default
 *   separately from the acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExportAssignment}.
 */
export const createExportDefault = (expression: Expression): ExportAssignment =>
  createExportAssignment(undefined, false, expression);
