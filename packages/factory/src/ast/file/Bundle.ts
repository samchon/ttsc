import type { SourceFile } from "./SourceFile";

/**
 * A bundle of source files emitted together.
 *
 * Built by {@link factory.createBundle}.
 *
 * @evidence contracts/common.md#principled-implementation An ordered readonly SourceFile collection represents files emitted together; it does not claim module linking or semantic validation.
 * @evidence contracts/common.md#clear-and-simple-design The bundle owns file grouping while SourceFile owns each statement sequence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Bundling stores supplied files without special fixture names or runtime overrides.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains grouping and constructor, with separated file-list documentation following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Bundle {
  /** Discriminant tag; always `"Bundle"`. */
  kind: "Bundle";

  /** The bundled source files. */
  sourceFiles: readonly SourceFile[];
}
