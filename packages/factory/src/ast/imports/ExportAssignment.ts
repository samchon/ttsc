import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";

/**
 * An `export default` or `export =` assignment.
 *
 * Built by {@link factory.createExportAssignment}.
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
