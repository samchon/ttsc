import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";

/**
 * An `export default` or `export =` assignment.
 *
 * Built by {@link factory.createExportAssignment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Expression and optional equals flag distinguish export-default from export-equals spelling; omitted flag selects default syntax without checking module-mode legality.
 * @evidence contracts/common.md#clear-and-simple-design One expression and syntax-choice flag avoid duplicating export assignment payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The flag is the documented export syntax distinction, not consumer-specific export behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies both assignments and documents the omitted flag's meaning; separated member prose follows the documentation skill.
 */
export interface ExportAssignment {
  /** Discriminant tag; always `"ExportAssignment"`. */
  kind: "ExportAssignment";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** When `true`, emit `export =`; otherwise `export default`. */
  isExportEquals?: boolean;

  /** The expression. */
  expression: Expression;
}
