import type { Statement } from "../statements/Statement";

/**
 * A whole source file: an ordered list of top-level statements.
 *
 * Built by {@link factory.createSourceFile}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SourceFile {
  /** Discriminant tag; always `"SourceFile"`. */
  kind: "SourceFile";

  /** The top-level statements. */
  statements: readonly Statement[];
}
