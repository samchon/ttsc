import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";

/**
 * An `export default` or `export =` assignment.
 *
 * Built by {@link factory.createExportAssignment}.
 *
 * @evidence contracts/common.md#principled-implementation Expression and optional equals flag distinguish export-default from export-equals spelling; omitted flag selects default syntax without checking module-mode legality.
 * @evidence contracts/common.md#clear-and-simple-design One expression and syntax-choice flag avoid duplicating export assignment payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The flag is the documented export syntax distinction, not consumer-specific export behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies both assignments and documents the omitted flag's meaning; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
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
