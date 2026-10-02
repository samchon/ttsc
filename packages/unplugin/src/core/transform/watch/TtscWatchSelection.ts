import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * What a delivery's watch notifications need from the project selection that
 * routed its file: the configs the selection read, which are handed to the host
 * beside every notification's own inputs (`selectionInputs`), the filesystem
 * their evidence is read through, and the selected tsconfig, which spells the
 * project for a notification that has no generation to spell it.
 *
 * @evidence contracts/common.md#principled-implementation The consulted configs preserve routing dependencies independently of the selected project, and the filesystem records which native view supplies their facts.
 * @evidence contracts/common.md#clear-and-simple-design A readonly delivery context groups routing inputs and their observation capability without copying project-generation state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The full consulted sequence is represented instead of assuming the selected tsconfig alone explains project routing.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains each field's notification role; spaced member comments and separated tags follow documentation guidance.
 */
export interface TtscWatchSelection {
  /** The configs the selection read, in the order it read them. */
  readonly consulted: readonly string[];

  /** The filesystem the delivery reads through. */
  readonly filesystem: TtscTransformFilesystemOperations;

  /** The selected project's tsconfig, as the adapter names it. */
  readonly tsconfig: string;
}
