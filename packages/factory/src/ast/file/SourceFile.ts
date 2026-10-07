import type { Statement } from "../statements/Statement";

/**
 * A whole source file: an ordered list of top-level statements.
 *
 * Built by {@link factory.createSourceFile}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The ordered Statement list preserves print order; this printable source container carries no compiler binding or checking state.
 * @evidence contracts/common.md#clear-and-simple-design A single statement collection delegates individual syntax details to each statement variant.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The container accepts supplied statement data without consumer-specific source substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc describes top-level ordering and constructor; separated member comments follow the documentation skill.
 */
export interface SourceFile {
  /** Discriminant tag; always `"SourceFile"`. */
  kind: "SourceFile";

  /** The top-level statements. */
  statements: readonly Statement[];
}
