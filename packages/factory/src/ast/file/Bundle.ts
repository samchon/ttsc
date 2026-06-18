import type { SourceFile } from "./SourceFile";

/**
 * A bundle of source files emitted together.
 *
 * Built by {@link factory.createBundle}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Bundle {
  /** Discriminant tag; always `"Bundle"`. */
  kind: "Bundle";

  /** The bundled source files. */
  sourceFiles: readonly SourceFile[];
}
