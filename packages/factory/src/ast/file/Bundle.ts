import type { SourceFile } from "./SourceFile";

/**
 * A bundle of source files emitted together.
 *
 * Built by {@link factory.createBundle}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered readonly SourceFile collection represents files emitted together; it does not claim module linking or semantic validation.
 * @evidence contracts/common.md#clear-and-simple-design The bundle owns file grouping while SourceFile owns each statement sequence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Bundling stores supplied files without special fixture names or runtime overrides.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains grouping and constructor, with separated file-list documentation following the documentation skill.
 */
export interface Bundle {
  /** Discriminant tag; always `"Bundle"`. */
  kind: "Bundle";

  /** The bundled source files. */
  sourceFiles: readonly SourceFile[];
}
