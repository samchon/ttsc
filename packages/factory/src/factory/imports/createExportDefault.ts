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
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExportAssignment}.
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
 */
export const createExportDefault = (expression: Expression): ExportAssignment =>
  createExportAssignment(undefined, false, expression);
