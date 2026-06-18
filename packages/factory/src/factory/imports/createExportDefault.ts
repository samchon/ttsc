import type { ExportAssignment, Expression } from "../../ast";
import { createExportAssignment } from "./createExportAssignment";

/**
 * Convenience wrapper that builds the corresponding expression node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created expression.
 */
export const createExportDefault = (expression: Expression): ExportAssignment =>
  createExportAssignment(undefined, false, expression);
