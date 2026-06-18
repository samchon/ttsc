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
