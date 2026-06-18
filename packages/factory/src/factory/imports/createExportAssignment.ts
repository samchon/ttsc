import type { ExportAssignment, Expression, ModifierLike } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ExportAssignment}.
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
