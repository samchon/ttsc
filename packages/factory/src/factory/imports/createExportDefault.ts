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
 */
export const createExportDefault = (expression: Expression): ExportAssignment =>
  createExportAssignment(undefined, false, expression);
